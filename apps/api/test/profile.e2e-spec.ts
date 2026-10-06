import type { PhotoDto, PhotoUploadDto } from '@dating/types';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { StorageService } from '../src/modules/storage/storage.service';
import { type TestContext, createTestApp } from './create-test-app';

const PASSWORD = 'very-secret-pass-1';

const INTERESTS = [
  { slug: 'coffee', name: 'Kahve', category: 'Yeme İçme', sortOrder: 1 },
  { slug: 'hiking', name: 'Doğa yürüyüşü', category: 'Spor', sortOrder: 2 },
  { slug: 'books', name: 'Kitaplar', category: 'Kültür', sortOrder: 3 },
];

const BASICS = {
  firstName: 'Ayşe',
  username: 'ayse',
  gender: 'WOMAN',
  bio: 'Kahve, kitaplar ve uzun yürüyüşler.',
  city: 'İstanbul',
  country: 'TR',
  heightCm: 168,
  languages: ['tr', 'en'],
  relationshipIntention: 'LONG_TERM',
};

async function jpegWithExif(): Promise<Buffer> {
  return sharp({ create: { width: 900, height: 1200, channels: 3, background: { r: 120, g: 90, b: 200 } } })
    .withExif({ IFD0: { Copyright: 'private-owner' } })
    .jpeg()
    .toBuffer();
}

async function uploadToStorage(upload: PhotoUploadDto['upload'], body: Buffer, type: string): Promise<Response> {
  const form = new FormData();
  for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
  form.append('file', new Blob([new Uint8Array(body)], { type }));
  return fetch(upload.url, { method: 'POST', body: form });
}

describe('Profile & photos (e2e)', () => {
  let ctx: TestContext;
  let http: ReturnType<typeof request>;
  let interestIds: number[];

  beforeAll(async () => {
    ctx = await createTestApp();
    http = request(ctx.app.getHttpServer());
    await ctx.prisma.interest.createMany({ data: INTERESTS, skipDuplicates: true });
    interestIds = (await ctx.prisma.interest.findMany({ where: { slug: { in: INTERESTS.map((i) => i.slug) } } })).map(
      (interest) => interest.id,
    );
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  async function createUser(email: string): Promise<string> {
    await http
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, birthDate: '1995-05-20' })
      .expect(202);
    const token = ctx.mail.tokenFrom(email, '/verify-email');
    await http.post('/api/v1/auth/verify-email').send({ token }).expect(200);
    const response = await http.post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
    return response.body.data.accessToken as string;
  }

  function as(token: string) {
    return {
      get: (url: string) => http.get(url).set('Authorization', `Bearer ${token}`),
      post: (url: string) => http.post(url).set('Authorization', `Bearer ${token}`),
      put: (url: string) => http.put(url).set('Authorization', `Bearer ${token}`),
      delete: (url: string) => http.delete(url).set('Authorization', `Bearer ${token}`),
    };
  }

  async function requestUpload(token: string, contentType = 'image/jpeg', size = 50_000): Promise<PhotoUploadDto> {
    const response = await as(token).post('/api/v1/photos/upload-url').send({ contentType, size }).expect(201);
    return response.body.data as PhotoUploadDto;
  }

  async function waitForPhoto(token: string, id: string): Promise<PhotoDto> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const response = await as(token).get('/api/v1/photos').expect(200);
      const photo = (response.body.data as PhotoDto[]).find((item) => item.id === id);
      if (photo && photo.status !== 'PROCESSING') return photo;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Photo ${id} was not processed in time`);
  }

  async function uploadPhoto(token: string, body: Buffer, contentType = 'image/jpeg'): Promise<PhotoDto> {
    const { photo, upload } = await requestUpload(token, contentType, body.length);
    const stored = await uploadToStorage(upload, body, contentType);
    expect(stored.status).toBe(204);
    const completed = await as(token).post(`/api/v1/photos/${photo.id}/complete`).expect(200);
    expect(completed.body.data.status).toBe('PROCESSING');
    return waitForPhoto(token, photo.id);
  }

  it('uploads directly to storage, processes in the worker and serves EXIF-free WebP variants', async () => {
    const token = await createUser('ayse@example.com');
    const photo = await uploadPhoto(token, await jpegWithExif());

    expect(photo.status).toBe('APPROVED');
    expect(photo).toMatchObject({ width: 900, height: 1200, rejectReason: null });
    expect(photo).not.toHaveProperty('moderationScore');

    const large = await fetch(photo.urls!.large);
    expect(large.status).toBe(200);
    const metadata = await sharp(Buffer.from(await large.arrayBuffer())).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.exif).toBeUndefined();
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBe(1200);

    const stored = await ctx.prisma.userPhoto.findUniqueOrThrow({ where: { id: photo.id } });
    const original = await ctx.app.get(StorageService).headUpload(stored.uploadKey);
    expect(original).toBeNull();

    const again = await as(token).post(`/api/v1/photos/${photo.id}/complete`).expect(200);
    expect(again.body.data.status).toBe('APPROVED');
  });

  it('rejects files that only pretend to be images', async () => {
    const token = await createUser('ayse@example.com');
    const photo = await uploadPhoto(token, Buffer.from('<?php echo "not an image"; ?>'.repeat(20)));
    expect(photo.status).toBe('REJECTED');
    expect(photo.urls).toBeNull();
    expect(photo.rejectReason).toEqual(expect.any(String));
  });

  it('rejects unsupported MIME types and the storage policy enforces the declared type', async () => {
    const token = await createUser('ayse@example.com');
    const gif = await as(token)
      .post('/api/v1/photos/upload-url')
      .send({ contentType: 'image/gif', size: 1000 })
      .expect(422);
    expect(gif.body.error.code).toBe('VALIDATION_ERROR');

    const { upload } = await requestUpload(token, 'image/jpeg');
    const tampered = { ...upload, fields: { ...upload.fields, 'Content-Type': 'text/html' } };
    const rejected = await uploadToStorage(tampered, await jpegWithExif(), 'text/html');
    expect(rejected.status).toBeGreaterThanOrEqual(400);
    expect(rejected.status).toBeLessThan(500);
  });

  it('limits a user to 6 photos', async () => {
    const token = await createUser('ayse@example.com');
    for (let index = 0; index < 6; index += 1) await requestUpload(token);
    const seventh = await as(token)
      .post('/api/v1/photos/upload-url')
      .send({ contentType: 'image/jpeg', size: 1000 })
      .expect(409);
    expect(seventh.body.error.code).toBe('CONFLICT');
  });

  it("does not let a user touch another user's photo", async () => {
    const owner = await createUser('ayse@example.com');
    const other = await createUser('mehmet@example.com');
    const { photo } = await requestUpload(owner);

    await as(other).delete(`/api/v1/photos/${photo.id}`).expect(404);
    await as(other).post(`/api/v1/photos/${photo.id}/complete`).expect(404);
    expect(await ctx.prisma.userPhoto.count({ where: { id: photo.id } })).toBe(1);

    await as(owner).delete(`/api/v1/photos/${photo.id}`).expect(200);
    expect(await ctx.prisma.userPhoto.count({ where: { id: photo.id } })).toBe(0);
  });

  it('refuses to complete onboarding until every step is done', async () => {
    const token = await createUser('ayse@example.com');
    const empty = await as(token).post('/api/v1/profile/me/complete-onboarding').expect(422);
    expect(empty.body.error.details).toEqual([{ path: 'onboarding', message: 'profile' }]);

    await as(token).put('/api/v1/profile/me').send(BASICS).expect(200);
    const noPhotos = await as(token).post('/api/v1/profile/me/complete-onboarding').expect(422);
    expect(noPhotos.body.error.details).toEqual([{ path: 'onboarding', message: 'photos' }]);

    const me = await as(token).get('/api/v1/profile/me').expect(200);
    expect(me.body.data.onboarding).toEqual({ completed: false, nextStep: 'photos' });
  });

  it('validates usernames and keeps them unique', async () => {
    const first = await createUser('ayse@example.com');
    const second = await createUser('mehmet@example.com');
    await as(first).put('/api/v1/profile/me').send(BASICS).expect(200);

    const availability = await as(second).get('/api/v1/profile/username-available?username=AYSE').expect(200);
    expect(availability.body.data).toEqual({ available: false });
    await as(second).get('/api/v1/profile/username-available?username=admin').expect(422);

    const taken = await as(second)
      .put('/api/v1/profile/me')
      .send({ ...BASICS, firstName: 'Mehmet', gender: 'MAN' })
      .expect(409);
    expect(taken.body.error.code).toBe('CONFLICT');
  });

  it('completes the full onboarding and exposes only public fields', async () => {
    const token = await createUser('ayse@example.com');
    const viewer = await createUser('mehmet@example.com');

    await as(viewer).get('/api/v1/profiles/ayse').expect(404);

    await as(token).put('/api/v1/profile/me').send(BASICS).expect(200);
    await as(token).put('/api/v1/profile/me/interests').send({ interestIds }).expect(200);
    await uploadPhoto(token, await jpegWithExif());
    await as(token)
      .put('/api/v1/profile/me/preferences')
      .send({ interestedIn: ['MAN'], ageMin: 25, ageMax: 40, maxDistanceKm: 50 })
      .expect(200);
    await as(token)
      .put('/api/v1/profile/me/location')
      .send({ latitude: 41.008238, longitude: 28.978359, city: 'İstanbul', country: 'TR' })
      .expect(200);

    const completed = await as(token).post('/api/v1/profile/me/complete-onboarding').expect(200);
    expect(completed.body.data.onboarding).toEqual({ completed: true, nextStep: null });
    expect(completed.body.data.completeness).toBe(75);

    const stored = await ctx.prisma.userProfile.findUniqueOrThrow({ where: { username: 'ayse' } });
    expect(stored).toMatchObject({ latitude: 41.01, longitude: 28.98 });
    expect(await ctx.prisma.auditLog.count({ where: { action: 'profile.onboarding_completed' } })).toBe(1);

    const response = await as(viewer).get('/api/v1/profiles/AYSE').expect(200);
    const profile = response.body.data;
    expect(profile).toMatchObject({
      firstName: 'Ayşe',
      username: 'ayse',
      age: expect.any(Number),
      city: 'İstanbul',
      verified: false,
    });
    expect(profile.interests).toHaveLength(INTERESTS.length);
    expect(profile.photos).toHaveLength(1);

    const serialized = JSON.stringify(profile);
    for (const forbidden of ['email', 'birthDate', 'latitude', 'longitude', 'moderationScore', 'uploadKey']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized).not.toContain('ayse@example.com');
    expect(serialized).not.toContain('1995');
  });
});

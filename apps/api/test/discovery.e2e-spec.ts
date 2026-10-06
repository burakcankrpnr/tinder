import type { DiscoveryFeedDto, SwipeResultDto } from '@dating/types';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DomainEvent, type MatchCreatedEvent } from '../src/common/events/domain-events';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type TestContext, createTestApp } from './create-test-app';
import { type TestUser, createTestUser } from './factories';

describe('Discovery & swipes (e2e)', () => {
  let ctx: TestContext;
  let http: ReturnType<typeof request>;
  let matchEvents: MatchCreatedEvent[];

  beforeAll(async () => {
    ctx = await createTestApp();
    http = request(ctx.app.getHttpServer());
    ctx.app.get(EventEmitter2).on(DomainEvent.MATCH_CREATED, (event: MatchCreatedEvent) => {
      matchEvents.push(event);
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await ctx.reset();
    matchEvents = [];
  });

  async function feed(user: TestUser, query = ''): Promise<DiscoveryFeedDto> {
    const response = await http
      .get(`/api/v1/discovery${query}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    return response.body.data as DiscoveryFeedDto;
  }

  function swipe(user: TestUser, targetUserId: string, action: string) {
    return http
      .post('/api/v1/swipes')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ targetUserId, action });
  }

  /** Erkekle ilgilenen 30 yaşında kadın izleyici. */
  function viewer(overrides: Parameters<typeof createTestUser>[1] = {}) {
    return createTestUser(ctx, { name: 'Ayse', gender: 'WOMAN', interestedIn: ['MAN'], age: 30, ...overrides });
  }

  function man(overrides: Parameters<typeof createTestUser>[1] = {}) {
    return createTestUser(ctx, { name: 'Mehmet', gender: 'MAN', interestedIn: ['WOMAN'], age: 32, ...overrides });
  }

  it('requires a completed profile', async () => {
    const incomplete = await viewer({ onboarded: false });
    const response = await http
      .get('/api/v1/discovery')
      .set('Authorization', `Bearer ${incomplete.token}`)
      .expect(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('applies mutual gender, age, distance and visibility filters', async () => {
    const me = await viewer({ ageMin: 25, ageMax: 40, maxDistanceKm: 30 });
    const match = await man();
    await man({ name: 'Tooold', age: 45 });
    await man({ name: 'Picky', ageMin: 18, ageMax: 25 });
    await man({ name: 'Notinto', interestedIn: ['MAN'] });
    await createTestUser(ctx, { name: 'Woman', gender: 'WOMAN', interestedIn: ['WOMAN'] });
    await man({ name: 'Ankara', latitude: 39.93, longitude: 32.86 });
    await man({ name: 'Nophoto', photos: 0 });
    await man({ name: 'Unfinished', onboarded: false });
    const banned = await man({ name: 'Banned' });
    await ctx.prisma.user.update({ where: { id: banned.id }, data: { status: 'RESTRICTED' } });

    const result = await feed(me);
    expect(result.cards.map((card) => card.id)).toEqual([match.id]);
    expect(result.cards[0]).toMatchObject({ distanceKm: 1, firstName: 'Mehmet', age: 32 });
    expect(JSON.stringify(result.cards[0])).not.toMatch(/latitude|longitude|email|birthDate/);
  });

  it('ranks by distance, activity and common interests and reports shared interests', async () => {
    await ctx.prisma.interest.createMany({
      data: [
        { slug: 'coffee', name: 'Kahve', category: 'Yeme İçme' },
        { slug: 'books', name: 'Kitaplar', category: 'Kültür' },
      ],
      skipDuplicates: true,
    });
    const interests = await ctx.prisma.interest.findMany({ where: { slug: { in: ['coffee', 'books'] } } });
    const ids = interests.map((interest) => interest.id);
    const me = await viewer({ interestIds: ids });
    const inactiveFar = await man({ name: 'Far', latitude: 41.2, longitude: 29.1, lastActiveAt: null });
    const activeNear = await man({ name: 'Near', interestIds: ids, photos: 3 });

    const result = await feed(me);
    expect(result.cards.map((card) => card.id)).toEqual([activeNear.id, inactiveFar.id]);
    expect(result.cards[0]?.commonInterests.sort()).toEqual(['books', 'coffee']);
    expect(result.cards[1]?.distanceKm).toBeGreaterThan(15);
  });

  it('excludes swiped and client-queued profiles and suggests actions when empty', async () => {
    const me = await viewer({ maxDistanceKm: 30, ageMin: 28, ageMax: 35 });
    const first = await man();
    const second = await man({ name: 'Kerem' });

    const queued = await feed(me, `?exclude=${first.id}`);
    expect(queued.cards.map((card) => card.id)).toEqual([second.id]);

    await swipe(me, first.id, 'PASS').expect(200);
    await swipe(me, second.id, 'LIKE').expect(200);
    const empty = await feed(me);
    expect(empty.cards).toEqual([]);
    expect(empty.suggestions).toEqual(['INCREASE_DISTANCE', 'WIDEN_AGE_RANGE', 'TRY_LATER']);
  });

  it('creates exactly one match on mutual likes and emits MATCH_CREATED', async () => {
    const ayse = await viewer();
    const mehmet = await man();

    const first = await swipe(ayse, mehmet.id, 'LIKE').expect(200);
    expect((first.body.data as SwipeResultDto).match).toBeNull();

    const second = await swipe(mehmet, ayse.id, 'LIKE').expect(200);
    const result = second.body.data as SwipeResultDto;
    expect(result.match).toMatchObject({ user: { id: ayse.id, firstName: 'Ayse', age: 30 } });
    expect(JSON.stringify(result.match)).not.toContain(ayse.email);

    const repeat = await swipe(mehmet, ayse.id, 'LIKE').expect(200);
    expect(repeat.body.data.match.id).toBe(result.match?.id);

    expect(await ctx.prisma.match.count()).toBe(1);
    expect(await ctx.prisma.swipe.count()).toBe(2);
    expect(matchEvents).toHaveLength(1);
  });

  it('handles simultaneous mutual likes without duplicate matches', async () => {
    const ayse = await viewer();
    const mehmet = await man();

    const [a, b] = await Promise.all([swipe(ayse, mehmet.id, 'LIKE'), swipe(mehmet, ayse.id, 'LIKE')]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const matches = [a.body.data.match, b.body.data.match].filter(Boolean);
    expect(matches).toHaveLength(1);
    expect(await ctx.prisma.match.count()).toBe(1);
    expect(matchEvents).toHaveLength(1);
  });

  it('rejects invalid swipes', async () => {
    const ayse = await viewer();
    const mehmet = await man();
    const hidden = await man({ name: 'Hidden', onboarded: false });

    await swipe(ayse, ayse.id, 'LIKE').expect(400);
    await swipe(ayse, hidden.id, 'LIKE').expect(404);
    await swipe(ayse, mehmet.id, 'MAYBE').expect(422);
    const superLike = await swipe(ayse, mehmet.id, 'SUPER_LIKE').expect(402);
    expect(superLike.body.error.code).toBe('LIMIT_REACHED');

    await swipe(ayse, mehmet.id, 'PASS').expect(200);
    const changed = await swipe(ayse, mehmet.id, 'LIKE').expect(409);
    expect(changed.body.error.code).toBe('CONFLICT');
    await swipe(ayse, mehmet.id, 'PASS').expect(200);
  });
});

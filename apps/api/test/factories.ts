import { randomUUID } from 'node:crypto';
import type { Gender, UserRole } from '@dating/types';
import { AuthService } from '../src/modules/auth/auth.service';
import { PasswordService } from '../src/modules/auth/password.service';
import type { TestContext } from './create-test-app';

export const TEST_PASSWORD = 'very-secret-pass-1';

export interface TestUserOptions {
  name?: string;
  gender?: Gender;
  interestedIn?: Gender[];
  /** Bugünden geriye yıl olarak yaş. */
  age?: number;
  ageMin?: number;
  ageMax?: number;
  maxDistanceKm?: number;
  latitude?: number;
  longitude?: number;
  onboarded?: boolean;
  photos?: number;
  interestIds?: number[];
  bio?: string | null;
  lastActiveAt?: Date | null;
}

export interface TestUser {
  id: string;
  email: string;
  username: string;
  token: string;
}

let cachedHash: Promise<string> | undefined;

function birthDateForAge(age: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - age, now.getUTCMonth(), now.getUTCDate()) - 24 * 60 * 60 * 1000);
}

/** Asenkron event consumer'ların sonucunu bekler. */
export async function eventually<T>(probe: () => Promise<T | undefined | null | false>, timeoutMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('Condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Rolü DB'de değiştirip yeni rolle tekrar oturum açar. */
export async function withRole(ctx: TestContext, user: TestUser, role: UserRole): Promise<TestUser> {
  await ctx.prisma.user.update({ where: { id: user.id }, data: { role } });
  return { ...user, token: await loginToken(ctx, user.email) };
}

export async function loginToken(ctx: TestContext, email: string): Promise<string> {
  const login = await ctx.app
    .get(AuthService)
    .login({ email, password: TEST_PASSWORD }, { ip: '127.0.0.1', userAgent: 'vitest', deviceName: null });
  return login.result.accessToken;
}

/** API akışını atlayıp doğrudan DB'de onboarding'i tamamlanmış kullanıcı oluşturur ve oturum açar. */
export async function createTestUser(ctx: TestContext, options: TestUserOptions = {}): Promise<TestUser> {
  const suffix = randomUUID().slice(0, 8);
  const name = options.name ?? 'Deniz';
  const email = `${name.toLowerCase()}.${suffix}@example.com`;
  const username = `${name.toLowerCase()}_${suffix}`;
  cachedHash ??= ctx.app.get(PasswordService).hash(TEST_PASSWORD);
  const onboarded = options.onboarded ?? true;

  const user = await ctx.prisma.user.create({
    data: {
      email,
      passwordHash: await cachedHash,
      emailVerifiedAt: new Date(),
      birthDate: birthDateForAge(options.age ?? 30),
      profile: {
        create: {
          firstName: name,
          username,
          gender: options.gender ?? 'WOMAN',
          bio: options.bio === undefined ? 'Kahve, kitaplar ve uzun yürüyüşler.' : options.bio,
          city: 'İstanbul',
          country: 'TR',
          languages: ['tr'],
          latitude: options.latitude ?? 41.01,
          longitude: options.longitude ?? 28.98,
          locationUpdatedAt: new Date(),
          onboardingCompletedAt: onboarded ? new Date() : null,
          lastActiveAt: options.lastActiveAt === undefined ? new Date() : options.lastActiveAt,
        },
      },
      preferences: {
        create: {
          interestedIn: options.interestedIn ?? ['MAN'],
          ageMin: options.ageMin ?? 18,
          ageMax: options.ageMax ?? 60,
          maxDistanceKm: options.maxDistanceKm ?? 50,
        },
      },
      interests: options.interestIds?.length
        ? { create: options.interestIds.map((interestId) => ({ interestId })) }
        : undefined,
      photos: {
        create: Array.from({ length: options.photos ?? 1 }, (_, position) => ({
          position,
          status: 'APPROVED' as const,
          uploadKey: `users/test/${randomUUID()}`,
          contentType: 'image/jpeg',
          width: 900,
          height: 1200,
          variants: {
            thumb: { key: `photos/test/${suffix}/${position}/thumb.webp`, width: 240, height: 320 },
            medium: { key: `photos/test/${suffix}/${position}/medium.webp`, width: 540, height: 720 },
            large: { key: `photos/test/${suffix}/${position}/large.webp`, width: 900, height: 1200 },
          },
        })),
      },
    },
  });

  const login = await ctx.app
    .get(AuthService)
    .login({ email, password: TEST_PASSWORD }, { ip: '127.0.0.1', userAgent: 'vitest', deviceName: null });
  return { id: user.id, email, username, token: login.result.accessToken };
}

import { randomUUID } from 'node:crypto';
import type { ApiEnv } from '@dating/config';
import type { Session, User } from '@dating/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/http/app.exception';
import type { RequestMeta } from '../../common/http/request-meta';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { SessionService } from './session.service';
import type { TokenService } from './token.service';

type SessionWhere = Partial<Pick<Session, 'id' | 'userId' | 'familyId'>> & {
  revokedAt?: null;
};

function matches(session: Session, where: SessionWhere): boolean {
  if (where.id && session.id !== where.id) return false;
  if (where.userId && session.userId !== where.userId) return false;
  if (where.familyId && session.familyId !== where.familyId) return false;
  if (where.revokedAt === null && session.revokedAt !== null) return false;
  return true;
}

function createFakePrisma(user: User) {
  const sessions: Session[] = [];
  const sessionApi = {
    create: async ({ data }: { data: Partial<Session> & Pick<Session, 'userId'> }) => {
      const session: Session = {
        id: data.id ?? randomUUID(),
        userId: data.userId,
        familyId: data.familyId ?? randomUUID(),
        refreshTokenHash: data.refreshTokenHash ?? '',
        userAgent: data.userAgent ?? null,
        ip: data.ip ?? null,
        deviceName: data.deviceName ?? null,
        lastUsedAt: new Date(),
        expiresAt: data.expiresAt ?? new Date(Date.now() + 60_000),
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
      };
      sessions.push(session);
      return session;
    },
    findUnique: async ({ where }: { where: { refreshTokenHash: string } }) => {
      const session = sessions.find((s) => s.refreshTokenHash === where.refreshTokenHash);
      return session ? { ...session, user } : null;
    },
    updateMany: async ({ where, data }: { where: SessionWhere; data: Partial<Session> }) => {
      const targets = sessions.filter((s) => matches(s, where));
      targets.forEach((s) => Object.assign(s, data));
      return { count: targets.length };
    },
  };
  const prisma = {
    session: sessionApi,
    $transaction: async <T>(fn: (tx: { session: typeof sessionApi }) => Promise<T>) =>
      fn({ session: sessionApi }),
  };
  return { prisma: prisma as unknown as PrismaService, sessions };
}

const user: User = {
  id: randomUUID(),
  email: 'user@example.com',
  passwordHash: 'hash',
  emailVerifiedAt: new Date(),
  birthDate: new Date('1995-01-01'),
  role: 'USER',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const meta: RequestMeta = { ip: '127.0.0.1', userAgent: 'test', deviceName: null };

describe('SessionService.rotate', () => {
  let service: SessionService;
  let sessions: Session[];
  let audit: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const fake = createFakePrisma(user);
    sessions = fake.sessions;
    let counter = 0;
    const tokens = {
      generateOpaqueToken: () => `token-${(counter += 1)}`,
      hashToken: (token: string) => `hash:${token}`,
    } as unknown as TokenService;
    audit = { log: vi.fn() };
    service = new SessionService(
      fake.prisma,
      tokens,
      audit as unknown as AuditService,
      { REFRESH_TOKEN_TTL_DAYS: 30 } as ApiEnv,
    );
  });

  it('issues a new token in the same family and revokes the old one', async () => {
    const first = await service.create(user.id, meta);
    const rotated = await service.rotate(first.refreshToken, meta);

    expect(rotated.refreshToken).not.toBe(first.refreshToken);
    expect(rotated.session.familyId).toBe(first.session.familyId);
    const old = sessions.find((s) => s.id === first.session.id);
    expect(old?.revokedAt).not.toBeNull();
    expect(old?.replacedById).toBe(rotated.session.id);
  });

  it('revokes the whole family when a rotated token is reused', async () => {
    const first = await service.create(user.id, meta);
    const rotated = await service.rotate(first.refreshToken, meta);

    await expect(service.rotate(first.refreshToken, meta)).rejects.toBeInstanceOf(AppException);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh_token_reuse_detected' }),
    );
    await expect(service.rotate(rotated.refreshToken, meta)).rejects.toBeInstanceOf(AppException);
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it('rejects unknown tokens', async () => {
    await expect(service.rotate('does-not-exist', meta)).rejects.toBeInstanceOf(AppException);
  });
});

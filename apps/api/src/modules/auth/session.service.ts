import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnv } from '@dating/config';
import type { Session, User } from '@dating/database';
import type { SessionDto } from '@dating/types';
import { canAuthenticate } from '../../common/auth/user-status';
import { AppException } from '../../common/http/app.exception';
import type { RequestMeta } from '../../common/http/request-meta';
import { ENV } from '../../config/env.module';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TokenService } from './token.service';

export interface IssuedSession {
  session: Session;
  refreshToken: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  private expiresAt(): Date {
    return new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * DAY_MS);
  }

  async create(userId: string, meta: RequestMeta): Promise<IssuedSession> {
    const refreshToken = this.tokens.generateOpaqueToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        familyId: randomUUID(),
        refreshTokenHash: this.tokens.hashToken(refreshToken),
        userAgent: meta.userAgent,
        ip: meta.ip,
        deviceName: meta.deviceName,
        expiresAt: this.expiresAt(),
      },
    });
    return { session, refreshToken };
  }

  /**
   * Refresh token rotation. Daha önce rotate edilmiş bir token tekrar gelirse
   * (token çalınmış olabilir) aynı family'deki tüm oturumlar iptal edilir.
   */
  async rotate(
    refreshToken: string,
    meta: RequestMeta,
  ): Promise<IssuedSession & { user: User }> {
    const existing = await this.prisma.session.findUnique({
      where: { refreshTokenHash: this.tokens.hashToken(refreshToken) },
      include: { user: true },
    });
    if (!existing) throw AppException.unauthorized('Oturum geçersiz.');

    if (existing.revokedAt) {
      if (existing.replacedById) {
        await this.revokeFamily(existing.familyId);
        await this.audit.log({
          actorUserId: existing.userId,
          action: 'auth.refresh_token_reuse_detected',
          targetType: 'session',
          targetId: existing.id,
          metadata: { ip: meta.ip },
        });
      }
      throw AppException.unauthorized('Oturum geçersiz.');
    }

    const { user } = existing;
    if (existing.expiresAt <= new Date() || !canAuthenticate(user)) {
      throw AppException.unauthorized('Oturum geçersiz.');
    }

    const nextToken = this.tokens.generateOpaqueToken();
    const nextId = randomUUID();
    const session = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: nextId },
      });
      if (revoked.count !== 1) throw AppException.unauthorized('Oturum geçersiz.');

      return tx.session.create({
        data: {
          id: nextId,
          userId: existing.userId,
          familyId: existing.familyId,
          refreshTokenHash: this.tokens.hashToken(nextToken),
          userAgent: meta.userAgent,
          ip: meta.ip,
          deviceName: meta.deviceName ?? existing.deviceName,
          expiresAt: this.expiresAt(),
        },
      });
    });

    return { session, refreshToken: nextToken, user };
  }

  async revokeByToken(refreshToken: string): Promise<string | null> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: this.tokens.hashToken(refreshToken) },
      select: { id: true, userId: true },
    });
    if (!session) return null;
    await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return session.userId;
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw AppException.notFound('Oturum bulunamadı.');
  }

  async revokeAll(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async hasKnownDevice(userId: string, meta: RequestMeta): Promise<boolean> {
    const count = await this.prisma.session.count({
      where: { userId, userAgent: meta.userAgent },
    });
    return count > 0;
  }

  async list(userId: string, currentSessionId: string): Promise<SessionDto[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      userAgent: session.userAgent,
      lastUsedAt: session.lastUsedAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      current: session.id === currentSessionId,
    }));
  }
}

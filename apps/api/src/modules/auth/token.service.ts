import { createHmac, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ApiEnv } from '@dating/config';
import type { UserRole } from '@dating/types';
import type { Redis } from 'ioredis';
import type { AuthUser } from '../../common/auth/auth-user';
import { AppException } from '../../common/http/app.exception';
import { ENV } from '../../config/env.module';
import { REDIS } from '../../infra/redis/redis.module';

interface AccessTokenPayload {
  sub: string;
  sid: string;
  role: UserRole;
  /** Milisaniye hassasiyetinde üretim zamanı; `iat` saniye olduğundan iptal karşılaştırması için. */
  iatMs: number;
}

const ROLES: readonly UserRole[] = ['USER', 'MODERATOR', 'ADMIN'];

function revokedBeforeKey(userId: string): string {
  return `auth:revoked-before:${userId}`;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  get accessTokenTtlSeconds(): number {
    return this.env.JWT_ACCESS_TTL_SECONDS;
  }

  generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /** Opaque token'lar DB'de yalnızca HMAC-SHA256 olarak saklanır. */
  hashToken(token: string): string {
    return createHmac('sha256', this.env.JWT_REFRESH_SECRET).update(token).digest('hex');
  }

  signAccessToken(user: AuthUser): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, sid: user.sessionId, role: user.role, iatMs: Date.now() };
    return this.jwt.signAsync(payload, {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      algorithm: 'HS256',
    });
  }

  /**
   * Ban veya rol değişikliğinde kullanıcının o ana kadar verilmiş access token'larını geçersiz kılar.
   * Kayıt yalnızca access token ömrü kadar tutulur; sonrasında eski token'lar zaten süresi dolmuş olur.
   */
  async revokeAccessTokens(userId: string): Promise<void> {
    await this.redis.set(revokedBeforeKey(userId), String(Date.now()), 'EX', this.env.JWT_ACCESS_TTL_SECONDS + 60);
  }

  async verifyAccessToken(token: string): Promise<AuthUser> {
    return (await this.verifyAccessTokenClaims(token)).user;
  }

  /** Uzun ömürlü bağlantılar (WebSocket) token süresi dolunca bağlantıyı kapatabilsin diye `expiresAt` da döner. */
  async verifyAccessTokenClaims(token: string): Promise<{ user: AuthUser; expiresAt: number }> {
    let payload: AccessTokenPayload & { exp: number };
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload & { exp: number }>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
      });
    } catch {
      throw AppException.unauthorized('Oturum geçersiz veya süresi dolmuş.');
    }
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.exp !== 'number' ||
      typeof payload.iatMs !== 'number' ||
      !ROLES.includes(payload.role)
    ) {
      throw AppException.unauthorized('Oturum geçersiz veya süresi dolmuş.');
    }
    const revokedBefore = await this.redis.get(revokedBeforeKey(payload.sub));
    if (revokedBefore !== null && payload.iatMs <= Number(revokedBefore)) {
      throw AppException.unauthorized('Oturum geçersiz veya süresi dolmuş.');
    }
    return {
      user: { id: payload.sub, sessionId: payload.sid, role: payload.role },
      expiresAt: payload.exp * 1000,
    };
  }
}

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { ApiEnv } from '@dating/config';
import type { User } from '@dating/database';
import { z } from 'zod';
import { canAuthenticate } from '../../common/auth/user-status';
import { AppException } from '../../common/http/app.exception';
import { ENV } from '../../config/env.module';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const PROVIDER = 'google';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const tokenResponseSchema = z.object({ access_token: z.string().min(1) });
const userInfoSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean(),
});

export class OAuthAccountNotFoundError extends Error {}

@Injectable()
export class GoogleOAuthService {
  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  get enabled(): boolean {
    return Boolean(this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET);
  }

  private get redirectUri(): string {
    return new URL('/api/v1/auth/google/callback', this.env.API_URL).toString();
  }

  private assertEnabled(): { clientId: string; clientSecret: string } {
    const clientId = this.env.GOOGLE_CLIENT_ID;
    const clientSecret = this.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new AppException('FEATURE_DISABLED', 'Google ile giriş aktif değil.', HttpStatus.NOT_FOUND);
    }
    return { clientId, clientSecret };
  }

  buildAuthorizationUrl(state: string): string {
    const { clientId } = this.assertEnabled();
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state,
      prompt: 'select_account',
    }).toString();
    return url.toString();
  }

  /**
   * Google hesabını mevcut bir kullanıcıya bağlar. Yeni kullanıcı oluşturulmaz:
   * kayıt için doğum tarihi (yaş doğrulaması) zorunlu olduğundan önce normal kayıt gerekir.
   */
  async resolveUser(code: string): Promise<User> {
    const { clientId, clientSecret } = this.assertEnabled();

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) throw AppException.unauthorized('Google doğrulaması başarısız.');
    const { access_token } = tokenResponseSchema.parse(await tokenResponse.json());

    const userInfoResponse = await fetch(USERINFO_URL, {
      headers: { authorization: `Bearer ${access_token}` },
    });
    if (!userInfoResponse.ok) throw AppException.unauthorized('Google doğrulaması başarısız.');
    const info = userInfoSchema.parse(await userInfoResponse.json());
    if (!info.email_verified) throw AppException.unauthorized('Google email adresi doğrulanmamış.');

    const linked = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: PROVIDER, providerAccountId: info.sub } },
      include: { user: true },
    });
    if (linked) return linked.user;

    const user = await this.prisma.user.findUnique({ where: { email: info.email.toLowerCase() } });
    if (!user || !canAuthenticate(user)) {
      throw new OAuthAccountNotFoundError();
    }

    await this.prisma.oAuthAccount.create({
      data: { userId: user.id, provider: PROVIDER, providerAccountId: info.sub },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'auth.oauth_linked',
      metadata: { provider: PROVIDER },
    });
    return user.emailVerifiedAt
      ? user
      : this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }
}

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Controller, Get, Inject, Logger, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { ApiEnv } from '@dating/config';
import type { Request, Response } from 'express';
import { Public } from '../../common/auth/decorators';
import { getRequestMeta } from '../../common/http/request-meta';
import { ENV } from '../../config/env.module';
import { AuthService } from './auth.service';
import { GoogleOAuthService, OAuthAccountNotFoundError } from './google-oauth.service';

const STATE_COOKIE = 'oauth_state';
const STATE_COOKIE_PATH = '/api/v1/auth/google';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

@Public()
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('auth/google')
export class GoogleOAuthController {
  private readonly logger = new Logger(GoogleOAuthController.name);
  private readonly secureCookies: boolean;

  constructor(
    private readonly google: GoogleOAuthService,
    private readonly auth: AuthService,
    @Inject(ENV) env: ApiEnv,
  ) {
    this.secureCookies = env.NODE_ENV === 'production';
  }

  @Get()
  start(@Res() response: Response): void {
    const state = randomBytes(24).toString('base64url');
    const url = this.google.buildAuthorizationUrl(state);
    response.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'lax',
      path: STATE_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    });
    response.redirect(url);
  }

  @Get('callback')
  async callback(
    @Req() request: Request,
    @Res() response: Response,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
  ): Promise<void> {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const expectedState = cookies?.[STATE_COOKIE];
    response.clearCookie(STATE_COOKIE, { path: STATE_COOKIE_PATH });

    if (!code || !state || typeof expectedState !== 'string' || !safeEqual(state, expectedState)) {
      response.redirect('dating://auth/callback?error=oauth_failed');
      return;
    }

    try {
      const user = await this.google.resolveUser(code);
      const outcome = await this.auth.startSession(user, getRequestMeta(request), 'google');
      const url = new URL('dating://auth/callback');
      url.searchParams.set('refreshToken', outcome.refreshToken);
      response.redirect(url.toString());
    } catch (error) {
      if (error instanceof OAuthAccountNotFoundError) {
        response.redirect('dating://auth/callback?error=oauth_account_not_found');
        return;
      }
      this.logger.warn({ err: error }, 'Google OAuth callback başarısız');
      response.redirect('dating://auth/callback?error=oauth_failed');
    }
  }
}

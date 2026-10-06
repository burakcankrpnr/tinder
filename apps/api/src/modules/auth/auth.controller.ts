import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { ApiEnv } from '@dating/config';
import type { AuthResultDto, MessageDto, SessionDto } from '@dating/types';
import {
  type EmailOnlyInput,
  type LoginInput,
  type RefreshTokenBody,
  type RegisterInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
  emailOnlySchema,
  loginSchema,
  refreshTokenBodySchema,
  registerSchema,
  resetPasswordSchema,
  sessionIdParamSchema,
  verifyEmailSchema,
} from '@dating/validation';
import type { Request, Response } from 'express';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser, Public } from '../../common/auth/decorators';
import { OriginGuard } from '../../common/auth/origin.guard';
import { AppException } from '../../common/http/app.exception';
import { ReqMeta, type RequestMeta } from '../../common/http/request-meta';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { ENV } from '../../config/env.module';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie';

const STRICT = { default: { limit: 5, ttl: 60_000 } };
const MODERATE = { default: { limit: 10, ttl: 60_000 } };
const refreshBody = new ZodValidationPipe(refreshTokenBodySchema);

function isMobileClient(request: Request): boolean {
  return request.header('x-client') === 'mobile';
}

function withMobileRefresh(
  result: AuthResultDto,
  refreshToken: string,
  mobile: boolean,
): AuthResultDto {
  return mobile ? { ...result, refreshToken } : result;
}

@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(ENV) env: ApiEnv,
  ) {
    this.secureCookies = env.NODE_ENV === 'production';
  }

  @Public()
  @Throttle(STRICT)
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @ReqMeta() meta: RequestMeta,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResultDto | MessageDto> {
    const mobile = isMobileClient(request);
    const outcome = await this.auth.register(body, meta, mobile);
    const pending: MessageDto = {
      message: 'Kayıt alındı. Hesabını aktifleştirmek için emailini kontrol et.',
    };
    if (!outcome || !isMobileClient(request)) return pending;
    setRefreshCookie(response, outcome.refreshToken, outcome.refreshExpiresAt, this.secureCookies);
    return withMobileRefresh(outcome.result, outcome.refreshToken, true);
  }

  @Public()
  @Throttle(MODERATE)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
  ): Promise<MessageDto> {
    await this.auth.verifyEmail(body.token);
    return { message: 'Email adresin doğrulandı.' };
  }

  @Public()
  @Throttle(STRICT)
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(
    @Body(new ZodValidationPipe(emailOnlySchema)) body: EmailOnlyInput,
  ): Promise<MessageDto> {
    await this.auth.resendVerification(body.email);
    return { message: 'Hesap doğrulanmamışsa yeni bir doğrulama emaili gönderildi.' };
  }

  @Public()
  @Throttle(MODERATE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @ReqMeta() meta: RequestMeta,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResultDto> {
    const outcome = await this.auth.login(body, meta);
    setRefreshCookie(response, outcome.refreshToken, outcome.refreshExpiresAt, this.secureCookies);
    return withMobileRefresh(outcome.result, outcome.refreshToken, isMobileClient(request));
  }

  @Public()
  @UseGuards(OriginGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Body(refreshBody) body: RefreshTokenBody,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResultDto> {
    const token = readRefreshCookie(request) ?? body.refreshToken;
    if (!token) throw AppException.unauthorized('Oturum bulunamadı.');
    try {
      const outcome = await this.auth.refresh(token, meta);
      setRefreshCookie(response, outcome.refreshToken, outcome.refreshExpiresAt, this.secureCookies);
      return withMobileRefresh(outcome.result, outcome.refreshToken, isMobileClient(request));
    } catch (error) {
      clearRefreshCookie(response, this.secureCookies);
      throw error;
    }
  }

  @Public()
  @UseGuards(OriginGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Body(refreshBody) body: RefreshTokenBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageDto> {
    await this.auth.logout(readRefreshCookie(request) ?? body.refreshToken);
    clearRefreshCookie(response, this.secureCookies);
    return { message: 'Çıkış yapıldı.' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageDto> {
    await this.auth.logoutAll(user.id);
    clearRefreshCookie(response, this.secureCookies);
    return { message: 'Tüm oturumlardan çıkış yapıldı.' };
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: AuthUser): Promise<SessionDto[]> {
    return this.sessions.list(user.id, user.sessionId);
  }

  @Delete('sessions/:id')
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(sessionIdParamSchema)) params: { id: string },
  ): Promise<MessageDto> {
    await this.sessions.revoke(user.id, params.id);
    return { message: 'Oturum sonlandırıldı.' };
  }

  @Public()
  @Throttle(STRICT)
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(
    @Body(new ZodValidationPipe(emailOnlySchema)) body: EmailOnlyInput,
  ): Promise<MessageDto> {
    await this.auth.forgotPassword(body.email);
    return { message: 'Bu email ile bir hesap varsa şifre sıfırlama bağlantısı gönderildi.' };
  }

  @Public()
  @Throttle(STRICT)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ): Promise<MessageDto> {
    await this.auth.resetPassword(body);
    return { message: 'Şifren güncellendi. Tüm oturumlar sonlandırıldı.' };
  }
}

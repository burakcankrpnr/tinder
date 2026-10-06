import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ApiEnv } from '@dating/config';
import { Prisma, type User } from '@dating/database';
import type { AuthResultDto, CurrentUserDto } from '@dating/types';
import {
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  isAllowedAge,
} from '@dating/validation';
import { canAuthenticate } from '../../common/auth/user-status';
import { DomainEvent, type UserRegisteredEvent } from '../../common/events/domain-events';
import { AppException } from '../../common/http/app.exception';
import type { RequestMeta } from '../../common/http/request-meta';
import { ENV } from '../../config/env.module';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  accountExistsMail,
  newDeviceLoginMail,
  passwordResetMail,
  verificationMail,
} from '../mail/auth-mails';
import { MailService } from '../mail/mail.service';
import { toCurrentUserDto } from '../users/user.mapper';
import { LoginAttemptsService } from './login-attempts.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export interface AuthOutcome {
  result: AuthResultDto;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly loginAttempts: LoginAttemptsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  private appUrl(pathname: string, token?: string): string {
    const url = new URL(pathname, this.env.EMAIL_LINK_ORIGIN ?? this.env.NEXT_PUBLIC_APP_URL);
    if (token) url.searchParams.set('token', token);
    return url.toString();
  }

  /**
   * Account enumeration koruması: email kayıtlı olsa da olmasa da aynı yanıt döner;
   * mevcut hesap sahibine bilgilendirme emaili gönderilir.
   */
  async register(input: RegisterInput, meta: RequestMeta, issueSession: boolean): Promise<AuthOutcome | null> {
    if (!isAllowedAge(input.birthDate)) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Platformu kullanmak için yaş şartını karşılamıyorsun.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const passwordHash = await this.passwords.hash(input.password);
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      await this.mail.send(accountExistsMail(existing.email, this.appUrl('/')));
      if (!issueSession || !existing.passwordHash || !canAuthenticate(existing)) return null;
      const valid = await this.passwords.verify(existing.passwordHash, input.password);
      return valid ? this.startSession(existing, meta, 'register') : null;
    }

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: { email: input.email, passwordHash, birthDate: input.birthDate },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
      throw error;
    }

    await this.audit.log({
      actorUserId: user.id,
      action: 'auth.registered',
      targetType: 'user',
      targetId: user.id,
      metadata: { ip: meta.ip },
    });
    const event: UserRegisteredEvent = { userId: user.id, method: 'password' };
    this.events.emit(DomainEvent.USER_REGISTERED, event);
    await this.sendVerification(user);
    return issueSession ? this.startSession(user, meta, 'register') : null;
  }

  private async sendVerification(user: User): Promise<void> {
    const token = this.tokens.generateOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: this.tokens.hashToken(token),
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        },
      }),
    ]);
    await this.mail.send(verificationMail(user.email, this.appUrl('/open/verify-email', token)));
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.tokens.hashToken(token) },
    });
    if (!record || record.expiresAt <= new Date()) {
      throw AppException.invalidToken();
    }
    if (record.usedAt) {
      const user = await this.prisma.user.findUnique({
        where: { id: record.userId },
        select: { emailVerifiedAt: true },
      });
      if (user?.emailVerifiedAt) return;
      throw AppException.invalidToken();
    }

    await this.prisma.$transaction(async (tx) => {
      const used = await tx.emailVerificationToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (used.count !== 1) throw AppException.invalidToken();
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
    });
    await this.audit.log({
      actorUserId: record.userId,
      action: 'auth.email_verified',
      targetType: 'user',
      targetId: record.userId,
    });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt || user.deletedAt) return;
    await this.sendVerification(user);
  }

  async login(input: LoginInput, meta: RequestMeta): Promise<AuthOutcome> {
    if (await this.loginAttempts.isLocked(input.email)) {
      throw new AppException(
        'ACCOUNT_LOCKED',
        'Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar dene.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const valid =
      user?.passwordHash && canAuthenticate(user)
        ? await this.passwords.verify(user.passwordHash, input.password)
        : await this.passwords.verifyAgainstDummy(input.password);

    if (!user || !valid) {
      await this.loginAttempts.recordFailure(input.email);
      if (user) {
        await this.audit.log({
          actorUserId: user.id,
          action: 'auth.login_failed',
          targetType: 'user',
          targetId: user.id,
          metadata: { ip: meta.ip },
        });
      }
      throw new AppException(
        'INVALID_CREDENTIALS',
        'Email veya şifre hatalı.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.emailVerifiedAt) {
      throw new AppException(
        'EMAIL_NOT_VERIFIED',
        'Giriş yapmadan önce email adresini doğrulamalısın.',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.loginAttempts.reset(input.email);
    return this.startSession(user, meta, 'password');
  }

  async startSession(user: User, meta: RequestMeta, method: string): Promise<AuthOutcome> {
    const knownDevice = await this.sessions.hasKnownDevice(user.id, meta);
    const { session, refreshToken } = await this.sessions.create(user.id, meta);

    await this.audit.log({
      actorUserId: user.id,
      action: 'auth.login',
      targetType: 'session',
      targetId: session.id,
      metadata: { ip: meta.ip, method, newDevice: !knownDevice },
    });
    if (!knownDevice) {
      const hadSessions = (await this.prisma.session.count({ where: { userId: user.id } })) > 1;
      if (hadSessions) await this.mail.send(newDeviceLoginMail(user.email, meta.deviceName));
    }

    return this.buildOutcome(user, session.id, refreshToken, session.expiresAt);
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<AuthOutcome> {
    const { session, refreshToken: next, user } = await this.sessions.rotate(refreshToken, meta);
    return this.buildOutcome(user, session.id, next, session.expiresAt);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const userId = await this.sessions.revokeByToken(refreshToken);
    if (userId) await this.audit.log({ actorUserId: userId, action: 'auth.logout' });
  }

  async logoutAll(userId: string): Promise<void> {
    const count = await this.sessions.revokeAll(userId);
    await this.audit.log({ actorUserId: userId, action: 'auth.logout_all', metadata: { count } });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !canAuthenticate(user)) return;

    const token = this.tokens.generateOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.tokens.hashToken(token),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      }),
    ]);
    await this.mail.send(passwordResetMail(user.email, this.appUrl('/open/reset-password', token)));
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.tokens.hashToken(input.token) },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw AppException.invalidToken();
    }

    const passwordHash = await this.passwords.hash(input.password);
    await this.prisma.$transaction(async (tx) => {
      const used = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (used.count !== 1) throw AppException.invalidToken();
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
      });
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.loginAttempts.reset(record.user.email);
    await this.audit.log({
      actorUserId: record.userId,
      action: 'auth.password_reset',
      targetType: 'user',
      targetId: record.userId,
    });
  }

  private async buildOutcome(
    user: User,
    sessionId: string,
    refreshToken: string,
    refreshExpiresAt: Date,
  ): Promise<AuthOutcome> {
    const accessToken = await this.tokens.signAccessToken({
      id: user.id,
      role: user.role,
      sessionId,
    });
    const dto: CurrentUserDto = toCurrentUserDto(user);
    return {
      result: { accessToken, expiresIn: this.tokens.accessTokenTtlSeconds, user: dto },
      refreshToken,
      refreshExpiresAt,
    };
  }
}

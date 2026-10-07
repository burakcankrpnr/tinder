import { HttpStatus, Injectable } from '@nestjs/common';
import type { CurrentUserDto } from '@dating/types';
import type { DeleteAccountInput } from '@dating/validation';
import { canAuthenticate } from '../../common/auth/user-status';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { PaymentProvider } from '../billing/payment-provider';
import { LIVE_STATUSES } from '../billing/subscription.mapper';
import { PhotosService } from '../photos/photos.service';
import { toCurrentUserDto } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly photos: PhotosService,
    private readonly provider: PaymentProvider,
    private readonly audit: AuditService,
  ) {}

  async getMe(userId: string): Promise<CurrentUserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !canAuthenticate(user)) {
      throw AppException.unauthorized();
    }
    return toCurrentUserDto(user);
  }

  /**
   * Settings → Delete Account: şifre ile yeniden doğrula, aboneliği hemen iptal et,
   * kişisel veriyi anonimleştir, oturumları kapat. Ödeme kayıtları yasal saklama için kalır.
   */
  async deleteAccount(userId: string, input: DeleteAccountInput): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { photos: true, profile: { select: { username: true } } },
    });
    if (!user || !canAuthenticate(user) || !user.passwordHash) {
      throw AppException.unauthorized();
    }
    if (!(await this.passwords.verify(user.passwordHash, input.password))) {
      throw new AppException('INVALID_CREDENTIALS', 'Şifre yanlış.', HttpStatus.UNAUTHORIZED);
    }

    const live = await this.prisma.subscription.findMany({
      where: { userId, status: { in: [...LIVE_STATUSES] } },
    });
    for (const subscription of live) {
      await this.provider.cancelSubscription(subscription.providerSubscriptionId, { atPeriodEnd: false });
    }

    const tombstoneEmail = `deleted-${userId}@invalid.local`;
    const tombstoneUsername = `d_${userId.replaceAll('-', '').slice(0, 18)}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.oAuthAccount.deleteMany({ where: { userId } });
      await tx.emailVerificationToken.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.device.deleteMany({ where: { userId } });
      await tx.userPhoto.deleteMany({ where: { userId } });
      await tx.userInterest.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.notificationPreferences.deleteMany({ where: { userId } });
      await tx.featureOverride.deleteMany({ where: { userId } });
      await tx.userPreferences.deleteMany({ where: { userId } });
      if (user.profile) {
        await tx.userProfile.update({
          where: { userId },
          data: {
            firstName: 'Silinmiş',
            username: tombstoneUsername,
            bio: null,
            city: null,
            country: null,
            occupation: null,
            education: null,
            educationLevel: null,
            sexualOrientation: null,
            kids: null,
            communicationStyle: null,
            loveStyle: null,
            pets: null,
            socialMedia: null,
            heightCm: null,
            languages: [],
            latitude: null,
            longitude: null,
            locationUpdatedAt: null,
            lastActiveAt: null,
            incognito: true,
            verificationStatus: 'UNVERIFIED',
          },
        });
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          email: tombstoneEmail,
          passwordHash: null,
          emailVerifiedAt: null,
          status: 'DEACTIVATED',
          deletedAt: new Date(),
        },
      });
    });

    await Promise.allSettled(user.photos.map((photo) => this.photos.deleteObjects(photo)));
    await this.sessions.revokeAll(userId);
    await this.audit.log({
      actorUserId: userId,
      action: 'account.deleted',
      targetType: 'user',
      targetId: userId,
      metadata: { previousUsername: user.profile?.username ?? null },
    });
  }
}

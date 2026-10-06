import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma, UserRole, UserStatus } from '@dating/database';
import type { AdminUserDetailDto, AdminUserSummaryDto, Page } from '@dating/types';
import {
  type AdminUsersQuery,
  type FeatureOverrideInput,
  type GrantEntitlementInput,
  type UpdateUserRoleInput,
  type UpdateUserStatusInput,
  calculateAge,
} from '@dating/validation';
import type { AuthUser } from '../../common/auth/auth-user';
import { DomainEvent, type UserStatusChangedEvent } from '../../common/events/domain-events';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { TokenService } from '../auth/token.service';
import { FREE_PLAN_SLUG } from '../billing/catalog.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { PaymentProvider } from '../billing/payment-provider';
import { LIVE_STATUSES, subscriptionState } from '../billing/subscription.mapper';
import { variantUrls } from '../photos/photo.mapper';
import { RealtimeService } from '../realtime/realtime.service';
import { StorageService } from '../storage/storage.service';
import { auditActorInclude, toAuditLogDto } from './admin-audit.service';
import { cursorArgs, toPage } from './pagination';

const OPEN_REPORT_STATUSES = ['OPEN', 'REVIEWING'] as const;
const STAFF_ROLES: readonly UserRole[] = ['ADMIN', 'MODERATOR'];

const summaryInclude = {
  profile: { select: { firstName: true, username: true, verificationStatus: true, lastActiveAt: true } },
  subscriptions: {
    where: { status: { in: [...LIVE_STATUSES] } },
    include: { plan: { select: { slug: true, name: true } } },
    take: 1,
  },
  _count: { select: { reportsReceived: { where: { status: { in: [...OPEN_REPORT_STATUSES] } } } } },
} satisfies Prisma.UserInclude;

type UserWithSummary = Prisma.UserGetPayload<{ include: typeof summaryInclude }>;

function toSummary(user: UserWithSummary): AdminUserSummaryDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.profile?.firstName ?? null,
    username: user.profile?.username ?? null,
    role: user.role,
    status: user.status,
    verificationStatus: user.profile?.verificationStatus ?? 'UNVERIFIED',
    plan: user.subscriptions[0]?.plan.slug ?? FREE_PLAN_SLUG,
    openReports: user._count.reportsReceived,
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: user.profile?.lastActiveAt?.toISOString() ?? null,
  };
}

/** Kullanıcı yönetimi (spec Bölüm 4 Admin/Moderator). Tüm değişiklikler audit log'a yazılır. */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly entitlements: EntitlementsService,
    private readonly provider: PaymentProvider,
    private readonly realtime: RealtimeService,
    private readonly storage: StorageService,
    private readonly events: EventEmitter2,
  ) {}

  async list(query: AdminUsersQuery): Promise<Page<AdminUserSummaryDto>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { profile: { username: { contains: query.q, mode: 'insensitive' } } },
              { profile: { firstName: { contains: query.q, mode: 'insensitive' } } },
              ...(/^[0-9a-f-]{36}$/i.test(query.q) ? [{ id: query.q }] : []),
            ],
          }
        : {}),
    };
    const users = await this.prisma.user.findMany({
      where,
      include: summaryInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...cursorArgs(query.cursor),
    });
    return toPage(users, query.limit, toSummary);
  }

  async detail(userId: string): Promise<AdminUserDetailDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        ...summaryInclude,
        profile: true,
        photos: { where: { status: { not: 'PENDING_UPLOAD' } }, orderBy: { position: 'asc' } },
        featureOverrides: { orderBy: { feature: 'asc' } },
        subscriptions: {
          where: { status: { in: [...LIVE_STATUSES] } },
          include: { plan: { select: { slug: true, name: true } } },
          take: 1,
        },
      },
    });
    if (!user || user.deletedAt) throw AppException.notFound('Kullanıcı bulunamadı.');

    const [likesGiven, likesReceived, matches, messages, reportsMade, activeSessions, recentAudit] = await Promise.all([
      this.prisma.swipe.count({ where: { actorUserId: userId, action: { in: ['LIKE', 'SUPER_LIKE'] } } }),
      this.prisma.swipe.count({ where: { targetUserId: userId, action: { in: ['LIKE', 'SUPER_LIKE'] } } }),
      this.prisma.match.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
      this.prisma.message.count({ where: { senderId: userId } }),
      this.prisma.report.count({ where: { reporterId: userId } }),
      this.prisma.session.count({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.auditLog.findMany({
        where: { OR: [{ targetId: userId }, { actorUserId: userId }] },
        include: auditActorInclude,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const subscription = user.subscriptions[0];
    const profile = user.profile;

    return {
      ...toSummary(user),
      emailVerified: user.emailVerifiedAt !== null,
      gender: profile?.gender ?? null,
      age: calculateAge(user.birthDate),
      city: profile?.city ?? null,
      country: profile?.country ?? null,
      bio: profile?.bio ?? null,
      onboardingCompleted: Boolean(profile?.onboardingCompletedAt),
      photos: user.photos.map((photo) => ({
        id: photo.id,
        status: photo.status,
        urls: variantUrls(photo, (key) => this.storage.publicUrl(key)),
        moderationScore: photo.moderationScore,
      })),
      subscription: subscription
        ? {
            id: subscription.id,
            plan: subscription.plan.slug,
            interval: subscription.interval,
            state: subscriptionState(subscription),
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          }
        : null,
      stats: { likesGiven, likesReceived, matches, messages, reportsMade },
      overrides: user.featureOverrides.map((override) => ({
        feature: override.feature,
        value: JSON.stringify(override.value),
      })),
      activeSessions,
      recentAudit: recentAudit.map(toAuditLogDto),
    };
  }

  private async loadTarget(actor: AuthUser, userId: string) {
    if (actor.id === userId) {
      throw new AppException('FORBIDDEN', 'Kendi hesabında bu işlemi yapamazsın.', HttpStatus.FORBIDDEN);
    }
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, deletedAt: true },
    });
    if (!target || target.deletedAt) throw AppException.notFound('Kullanıcı bulunamadı.');
    if (STAFF_ROLES.includes(target.role) && actor.role !== 'ADMIN') {
      throw new AppException('FORBIDDEN', 'Yönetici hesaplarını yalnızca admin yönetebilir.', HttpStatus.FORBIDDEN);
    }
    return target;
  }

  /**
   * ACTIVE / RESTRICTED / BANNED geçişi. Ban'de tüm oturumlar ve access token'lar iptal edilir,
   * açık WebSocket bağlantıları kapatılır ve abonelik yenilemesi durdurulur.
   */
  async updateStatus(actor: AuthUser, userId: string, input: UpdateUserStatusInput): Promise<AdminUserDetailDto> {
    await this.moderate(actor, userId, input.status, input.reason);
    return this.detail(userId);
  }

  /** `escalateOnly`: report çözümünde mevcut daha ağır bir yaptırımı (ör. BANNED → RESTRICTED) hafifletmez. */
  async moderate(
    actor: AuthUser,
    userId: string,
    to: 'ACTIVE' | 'RESTRICTED' | 'BANNED',
    reason: string,
    options: { escalateOnly?: boolean } = {},
  ): Promise<boolean> {
    const target = await this.loadTarget(actor, userId);
    if (target.status === 'DEACTIVATED') {
      throw new AppException('CONFLICT', 'Kullanıcı hesabını kapatmış.', HttpStatus.CONFLICT);
    }
    const severity: Record<string, number> = { ACTIVE: 0, RESTRICTED: 1, BANNED: 2 };
    if (options.escalateOnly && (severity[target.status] ?? 0) >= severity[to]!) return false;
    return this.applyStatus(actor.id, target.id, target.status, to, reason);
  }

  /** Moderasyon akışlarından (report çözümü, otomatik kurallar) da çağrılır. */
  async applyStatus(
    actorUserId: string | null,
    userId: string,
    from: UserStatus,
    to: 'ACTIVE' | 'RESTRICTED' | 'BANNED',
    reason: string,
  ): Promise<boolean> {
    if (from === to) return false;
    const updated = await this.prisma.user.updateMany({
      where: { id: userId, status: from, deletedAt: null },
      data: { status: to },
    });
    if (updated.count === 0) {
      throw new AppException('CONFLICT', 'Kullanıcının durumu bu sırada değişti, sayfayı yenile.', HttpStatus.CONFLICT);
    }

    if (to === 'BANNED') {
      await Promise.all([this.sessions.revokeAll(userId), this.tokens.revokeAccessTokens(userId)]);
      this.realtime.disconnectUser(userId);
      await this.stopRenewal(userId);
    }

    await this.audit.log({
      actorUserId,
      action: `moderation.user_${to.toLowerCase()}`,
      targetType: 'user',
      targetId: userId,
      metadata: { from, to, reason },
    });
    if (actorUserId) {
      const event: UserStatusChangedEvent = { userId, actorUserId, from, to, reason };
      this.events.emit(DomainEvent.USER_STATUS_CHANGED, event);
    }
    return true;
  }

  private async stopRenewal(userId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: [...LIVE_STATUSES] }, cancelAtPeriodEnd: false },
    });
    if (!subscription) return;
    try {
      await this.provider.cancelSubscription(subscription.providerSubscriptionId, { atPeriodEnd: true });
    } catch (error) {
      this.logger.error({ err: error, subscriptionId: subscription.id }, 'Yasaklanan kullanıcının aboneliği iptal edilemedi');
    }
  }

  async updateRole(actor: AuthUser, userId: string, input: UpdateUserRoleInput): Promise<AdminUserDetailDto> {
    const target = await this.loadTarget(actor, userId);
    if (target.role !== input.role) {
      await this.prisma.user.update({ where: { id: userId }, data: { role: input.role } });
      // Eski role sahip access token'lar bir sonraki yenilemeye kadar kullanılamasın.
      await this.tokens.revokeAccessTokens(userId);
      await this.audit.log({
        actorUserId: actor.id,
        action: 'admin.role_changed',
        targetType: 'user',
        targetId: userId,
        metadata: { from: target.role, to: input.role },
      });
    }
    return this.detail(userId);
  }

  async setOverride(actor: AuthUser, userId: string, input: FeatureOverrideInput): Promise<AdminUserDetailDto> {
    await this.loadTarget(actor, userId);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const value = input.value as Prisma.InputJsonValue;
    await this.prisma.featureOverride.upsert({
      where: { userId_feature: { userId, feature: input.feature } },
      create: { userId, feature: input.feature, value, expiresAt },
      update: { value, expiresAt },
    });
    await this.audit.log({
      actorUserId: actor.id,
      action: 'admin.feature_override_set',
      targetType: 'user',
      targetId: userId,
      metadata: { feature: input.feature, value: input.value, expiresAt: input.expiresAt ?? null },
    });
    return this.detail(userId);
  }

  async removeOverride(actor: AuthUser, userId: string, feature: string): Promise<AdminUserDetailDto> {
    await this.loadTarget(actor, userId);
    const removed = await this.prisma.featureOverride.deleteMany({ where: { userId, feature } });
    if (removed.count > 0) {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'admin.feature_override_removed',
        targetType: 'user',
        targetId: userId,
        metadata: { feature },
      });
    }
    return this.detail(userId);
  }

  async grant(actor: AuthUser, userId: string, input: GrantEntitlementInput): Promise<AdminUserDetailDto> {
    await this.loadTarget(actor, userId);
    await this.entitlements.grant(this.prisma, {
      userId,
      type: input.type,
      quantity: input.quantity,
      source: 'ADMIN',
      grantKey: `admin:${randomUUID()}`,
    });
    await this.audit.log({
      actorUserId: actor.id,
      action: 'admin.entitlement_granted',
      targetType: 'user',
      targetId: userId,
      metadata: { type: input.type, quantity: input.quantity, reason: input.reason },
    });
    return this.detail(userId);
  }
}

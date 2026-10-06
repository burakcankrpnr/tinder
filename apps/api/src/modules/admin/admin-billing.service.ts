import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@dating/database';
import type { AdminPaymentDto, AdminPlanDto, AdminSubscriptionDto, Page } from '@dating/types';
import type {
  AdminCancelSubscriptionInput,
  AdminPaymentsQuery,
  AdminSubscriptionsQuery,
  RefundInput,
  UpdatePlanInput,
} from '@dating/validation';
import type { Redis } from 'ioredis';
import type { AuthUser } from '../../common/auth/auth-user';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { REDIS } from '../../infra/redis/redis.module';
import { AuditService } from '../audit/audit.service';
import { CatalogService, FREE_PLAN_SLUG } from '../billing/catalog.service';
import { PaymentProvider } from '../billing/payment-provider';
import { LIVE_STATUSES, subscriptionState } from '../billing/subscription.mapper';
import { cursorArgs, toPage } from './pagination';

const REFUND_LOCK_SECONDS = 5 * 60;
const INTERVAL_LABELS = { MONTHLY: 'aylık', YEARLY: 'yıllık' } as const;

function stateFilter(state: AdminSubscriptionsQuery['state']): Prisma.SubscriptionWhereInput {
  switch (state) {
    case 'ACTIVE':
      return { status: 'ACTIVE', cancelAtPeriodEnd: false };
    case 'CANCEL_AT_PERIOD_END':
      return { status: 'ACTIVE', cancelAtPeriodEnd: true };
    case 'GRACE_PERIOD':
      return { status: 'PAST_DUE' };
    case 'EXPIRED':
      return { status: 'EXPIRED' };
    default:
      return {};
  }
}

const paymentInclude = {
  user: { select: { email: true } },
  checkoutSession: { include: { plan: true, product: true } },
  subscription: { include: { plan: true } },
} satisfies Prisma.PaymentInclude;

type PaymentWithRelations = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

function describePayment(payment: PaymentWithRelations): string {
  const session = payment.checkoutSession;
  if (session?.plan && session.interval) return `${session.plan.name} (${INTERVAL_LABELS[session.interval]})`;
  if (session?.product) return session.product.name;
  if (payment.subscription) return `${payment.subscription.plan.name} yenileme`;
  return 'Ödeme';
}

/**
 * Admin ödeme/abonelik işlemleri. İade ve iptal provider'a iletilir; DB durumu yine yalnızca
 * provider'ın doğrulanmış webhook'u ile değişir (spec Bölüm 13).
 */
@Injectable()
export class AdminBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: PaymentProvider,
    private readonly catalog: CatalogService,
    private readonly audit: AuditService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async subscriptions(query: AdminSubscriptionsQuery): Promise<Page<AdminSubscriptionDto>> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { ...stateFilter(query.state), ...(query.plan ? { plan: { slug: query.plan } } : {}) },
      include: { plan: { select: { slug: true } }, user: { select: { email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...cursorArgs(query.cursor),
    });
    return toPage(subscriptions, query.limit, (subscription) => ({
      id: subscription.id,
      userId: subscription.userId,
      email: subscription.user.email,
      plan: subscription.plan.slug,
      interval: subscription.interval,
      state: subscriptionState(subscription),
      provider: subscription.provider,
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      createdAt: subscription.createdAt.toISOString(),
    }));
  }

  async cancelSubscription(actor: AuthUser, subscriptionId: string, input: AdminCancelSubscriptionInput): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!subscription) throw AppException.notFound('Abonelik bulunamadı.');
    if (!(LIVE_STATUSES as readonly string[]).includes(subscription.status)) {
      throw new AppException('CONFLICT', 'Abonelik zaten sona ermiş.', HttpStatus.CONFLICT);
    }
    if (!input.immediately && subscription.cancelAtPeriodEnd) {
      throw new AppException('CONFLICT', 'Abonelik zaten dönem sonunda bitecek.', HttpStatus.CONFLICT);
    }
    await this.provider.cancelSubscription(subscription.providerSubscriptionId, { atPeriodEnd: !input.immediately });
    await this.audit.log({
      actorUserId: actor.id,
      action: 'admin.subscription_canceled',
      targetType: 'subscription',
      targetId: subscriptionId,
      metadata: { userId: subscription.userId, immediately: input.immediately, reason: input.reason },
    });
  }

  async payments(query: AdminPaymentsQuery): Promise<Page<AdminPaymentDto>> {
    const payments = await this.prisma.payment.findMany({
      where: { ...(query.status ? { status: query.status } : {}), ...(query.userId ? { userId: query.userId } : {}) },
      include: paymentInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...cursorArgs(query.cursor),
    });
    return toPage(payments, query.limit, (payment) => this.toPaymentDto(payment));
  }

  private toPaymentDto(payment: PaymentWithRelations): AdminPaymentDto {
    return {
      id: payment.id,
      userId: payment.userId,
      email: payment.user.email,
      description: describePayment(payment),
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      createdAt: payment.createdAt.toISOString(),
      refundedAt: payment.refundedAt?.toISOString() ?? null,
    };
  }

  /** Aynı ödeme için eşzamanlı iki iade isteği provider'a iki kez gitmesin diye kısa süreli Redis kilidi. */
  async refund(actor: AuthUser, paymentId: string, input: RefundInput): Promise<AdminPaymentDto> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw AppException.notFound('Ödeme bulunamadı.');
    if (payment.status !== 'SUCCEEDED') {
      throw new AppException('CONFLICT', 'Yalnızca başarılı ödemeler iade edilebilir.', HttpStatus.CONFLICT);
    }
    const lockKey = `lock:refund:${paymentId}`;
    const locked = await this.redis.set(lockKey, actor.id, 'EX', REFUND_LOCK_SECONDS, 'NX');
    if (locked !== 'OK') {
      throw new AppException('CONFLICT', 'Bu ödeme için iade işlemi zaten sürüyor.', HttpStatus.CONFLICT);
    }
    try {
      await this.provider.refund(payment.providerPaymentId);
    } catch (error) {
      await this.redis.del(lockKey);
      throw error;
    }
    await this.audit.log({
      actorUserId: actor.id,
      action: 'admin.payment_refund_requested',
      targetType: 'payment',
      targetId: paymentId,
      metadata: { userId: payment.userId, amount: payment.amount, reason: input.reason },
    });
    const updated = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: paymentInclude });
    return this.toPaymentDto(updated);
  }

  async plans(): Promise<AdminPlanDto[]> {
    const now = new Date();
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { monthlyPrice: 'asc' }],
      include: {
        _count: {
          select: {
            subscriptions: {
              where: {
                OR: [
                  { status: 'ACTIVE', currentPeriodEnd: { gt: now } },
                  { status: 'PAST_DUE', graceUntil: { gt: now } },
                ],
              },
            },
          },
        },
      },
    });
    return plans.map((plan) => ({
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      currency: plan.currency,
      swipeLimit: plan.swipeLimit,
      superLikeLimit: plan.superLikeLimit,
      boostLimit: plan.boostLimit,
      active: plan.active,
      activeSubscribers: plan._count.subscriptions,
    }));
  }

  /** Fiyat değişikliği yalnızca yeni checkout'lara yansır; mevcut aboneliklerin dönem fiyatı değişmez. */
  async updatePlan(actor: AuthUser, planId: string, input: UpdatePlanInput): Promise<AdminPlanDto[]> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw AppException.notFound('Paket bulunamadı.');
    if (plan.slug === FREE_PLAN_SLUG && (input.active === false || input.monthlyPrice || input.yearlyPrice)) {
      throw new AppException('BAD_REQUEST', 'Ücretsiz paket kapatılamaz veya ücretlendirilemez.', HttpStatus.BAD_REQUEST);
    }
    if (plan.slug !== FREE_PLAN_SLUG && (input.monthlyPrice === 0 || input.yearlyPrice === 0)) {
      throw new AppException('BAD_REQUEST', 'Ücretli paketin fiyatı 0 olamaz.', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.subscriptionPlan.update({ where: { id: planId }, data: input });
    this.catalog.invalidate();
    await this.audit.log({
      actorUserId: actor.id,
      action: 'admin.plan_updated',
      targetType: 'subscription_plan',
      targetId: planId,
      metadata: { slug: plan.slug, changes: input as Prisma.InputJsonObject },
    });
    return this.plans();
  }
}

import { HttpStatus, Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma, Subscription } from '@dating/database';
import type { Redis } from 'ioredis';
import {
  DomainEvent,
  type PaymentEventPayload,
  type PaymentRefundedEvent,
  type SubscriptionEvent,
} from '../../common/events/domain-events';
import { AppException } from '../../common/http/app.exception';
import { type DbClient, isUniqueViolation } from '../../infra/prisma/prisma-errors';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { REDIS } from '../../infra/redis/redis.module';
import { EntitlementsService } from './entitlements.service';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentProvider, type ProviderEvent, type WebhookHeaders } from './payment-provider';
import { LIVE_STATUSES, type SubscriptionWithPlan } from './subscription.mapper';

/** Ödeme başarısız olunca premium bu süre boyunca açık kalır (spec Bölüm 39 GRACE_PERIOD). */
export const GRACE_PERIOD_DAYS = 3;
/** İptal edilmiş aboneliğin bitişinden bu kadar önce SUBSCRIPTION_EXPIRING bildirimi gider. */
export const EXPIRING_NOTICE_DAYS = 3;
/** Yenileme webhook'u gelmeyen aboneliğin süresi bu kadar bekledikten sonra dolmuş sayılır. */
const RENEWAL_WEBHOOK_LEEWAY_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEBHOOK_CACHE_SECONDS = 24 * 60 * 60;

interface Effects {
  events: Array<{ name: string; payload: unknown }>;
  refunds: string[];
}

export interface WebhookResult {
  received: true;
  duplicate: boolean;
}

function subscriptionEvent(subscription: SubscriptionWithPlan): SubscriptionEvent {
  return {
    subscriptionId: subscription.id,
    userId: subscription.userId,
    planSlug: subscription.plan.slug,
    planName: subscription.plan.name,
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
  };
}

/**
 * Abonelik durumunu değiştiren tek yer. Spec Bölüm 13: durum yalnızca doğrulanmış webhook ile değişir
 * (zamana bağlı bitişler hariç). Spec Bölüm 29: aynı event birden çok gelse de tek kez işlenir.
 */
@Injectable()
export class BillingLifecycleService implements OnModuleInit {
  private readonly logger = new Logger(BillingLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: PaymentProvider,
    private readonly entitlements: EntitlementsService,
    private readonly events: EventEmitter2,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    if (this.provider instanceof MockPaymentProvider) {
      this.provider.connect((rawBody, headers) => this.receive(this.provider.name, rawBody, headers));
    }
  }

  async receive(providerName: string, rawBody: Buffer | undefined, headers: WebhookHeaders): Promise<WebhookResult> {
    if (providerName !== this.provider.name) throw AppException.notFound('Ödeme sağlayıcısı bulunamadı.');
    if (!rawBody || rawBody.length === 0) {
      throw new AppException('BAD_REQUEST', 'Boş webhook gövdesi.', HttpStatus.BAD_REQUEST);
    }
    const event = this.provider.verifyWebhook(rawBody, headers);
    if (!event) {
      this.logger.warn({ provider: providerName }, 'Webhook imzası doğrulanamadı');
      throw new AppException('INVALID_SIGNATURE', 'Webhook doğrulanamadı.', HttpStatus.BAD_REQUEST);
    }
    return this.process(event);
  }

  private async process(event: ProviderEvent): Promise<WebhookResult> {
    const effects: Effects = { events: [], refunds: [] };
    const provider = this.provider.name;
    const cacheKey = `webhook:${provider}:${event.id}`;
    if (await this.seenRecently(cacheKey)) {
      this.logger.log({ eventId: event.id, type: event.type }, 'Tekrarlanan webhook yok sayıldı');
      return { received: true, duplicate: true };
    }
    let duplicate = false;
    try {
      await this.prisma.$transaction(async (tx) => {
        const inserted = await tx.paymentEvent.createMany({
          data: [
            {
              provider,
              providerEventId: event.id,
              type: event.type,
              payload: event as unknown as Prisma.InputJsonValue,
            },
          ],
          skipDuplicates: true,
        });
        if (inserted.count === 0) {
          duplicate = true;
          return;
        }
        await this.apply(tx, event, new Date(), effects);
        await tx.paymentEvent.update({
          where: { provider_providerEventId: { provider, providerEventId: event.id } },
          data: { processedAt: new Date() },
        });
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      duplicate = true;
    }

    await this.remember(cacheKey);
    if (duplicate) {
      this.logger.log({ eventId: event.id, type: event.type }, 'Tekrarlanan webhook yok sayıldı');
      return { received: true, duplicate: true };
    }
    this.flush(effects);
    return { received: true, duplicate: false };
  }

  /** Redis yalnızca hızlı yol; asıl idempotency garantisi `payment_events` unique kaydıdır. */
  private async seenRecently(key: string): Promise<boolean> {
    try {
      return (await this.redis.exists(key)) === 1;
    } catch (error) {
      this.logger.warn({ err: error }, 'Webhook idempotency cache okunamadı');
      return false;
    }
  }

  private async remember(key: string): Promise<void> {
    try {
      await this.redis.set(key, '1', 'EX', WEBHOOK_CACHE_SECONDS);
    } catch (error) {
      this.logger.warn({ err: error }, 'Webhook idempotency cache yazılamadı');
    }
  }

  private flush(effects: Effects): void {
    for (const { name, payload } of effects.events) this.events.emit(name, payload);
    for (const paymentId of effects.refunds) {
      this.provider.refund(paymentId).catch((error: unknown) => {
        this.logger.error({ err: error, paymentId }, 'Mükerrer ödeme iadesi başlatılamadı');
      });
    }
  }

  private async apply(tx: DbClient, event: ProviderEvent, now: Date, effects: Effects): Promise<void> {
    const provider = this.provider.name;
    switch (event.type) {
      case 'checkout.completed': {
        const { data } = event;
        const session = await tx.checkoutSession.findUnique({
          where: { providerCheckoutId: data.checkoutId },
          include: { plan: true, product: true },
        });
        if (!session || session.provider !== provider) throw new Error(`Bilinmeyen checkout: ${data.checkoutId}`);
        await tx.checkoutSession.update({
          where: { id: session.id },
          data: { status: 'COMPLETED', completedAt: now },
        });
        const paymentBase = {
          userId: session.userId,
          checkoutSessionId: session.id,
          provider,
          providerPaymentId: data.paymentId,
          amount: data.amount,
          currency: data.currency,
        };

        if (session.kind === 'PRODUCT') {
          const product = session.product;
          if (!product) throw new Error(`Checkout ürünü yok: ${session.id}`);
          const payment = await this.recordPayment(tx, { ...paymentBase, status: 'SUCCEEDED' });
          await this.entitlements.grant(tx, {
            userId: session.userId,
            type: product.type,
            quantity: product.quantity,
            source: 'PURCHASE',
            grantKey: `checkout:${session.id}`,
          });
          effects.events.push({
            name: DomainEvent.PAYMENT_SUCCEEDED,
            payload: this.paymentEvent(payment, null, null),
          });
          return;
        }

        const plan = session.plan;
        if (!plan || !session.interval || !data.subscription) {
          throw new Error(`Abonelik checkout'u eksik: ${session.id}`);
        }
        const live = await tx.subscription.findFirst({
          where: { userId: session.userId, status: { in: [...LIVE_STATUSES] } },
          include: { plan: true },
        });
        if (live && this.isStillLive(live, now)) {
          // Aynı anda iki checkout tamamlandı: ikinci ödeme iade edilir, ikinci abonelik açılmaz.
          await this.recordPayment(tx, { ...paymentBase, status: 'SUCCEEDED' });
          effects.refunds.push(data.paymentId);
          return;
        }
        if (live) await this.expire(tx, live, now, effects);

        const subscription = await tx.subscription.create({
          data: {
            userId: session.userId,
            planId: plan.id,
            provider,
            providerSubscriptionId: data.subscription.id,
            providerCustomerId: data.customerId,
            interval: session.interval,
            status: 'ACTIVE',
            currentPeriodStart: new Date(data.subscription.periodStart),
            currentPeriodEnd: new Date(data.subscription.periodEnd),
          },
          include: { plan: true },
        });
        const payment = await this.recordPayment(tx, {
          ...paymentBase,
          subscriptionId: subscription.id,
          status: 'SUCCEEDED',
        });
        effects.events.push(
          { name: DomainEvent.SUBSCRIPTION_CREATED, payload: subscriptionEvent(subscription) },
          { name: DomainEvent.PAYMENT_SUCCEEDED, payload: this.paymentEvent(payment, subscription.id, plan.name) },
        );
        return;
      }

      case 'checkout.failed': {
        const { data } = event;
        const session = await tx.checkoutSession.findUnique({ where: { providerCheckoutId: data.checkoutId } });
        if (!session) throw new Error(`Bilinmeyen checkout: ${data.checkoutId}`);
        await tx.checkoutSession.updateMany({ where: { id: session.id, status: 'OPEN' }, data: { status: 'FAILED' } });
        const payment = await this.recordPayment(tx, {
          userId: session.userId,
          checkoutSessionId: session.id,
          provider,
          providerPaymentId: data.paymentId,
          amount: data.amount,
          currency: data.currency,
          status: 'FAILED',
          failureReason: data.reason,
        });
        effects.events.push({
          name: DomainEvent.PAYMENT_FAILED,
          payload: { ...this.paymentEvent(payment, null, null), reason: data.reason },
        });
        return;
      }

      case 'checkout.canceled': {
        await tx.checkoutSession.updateMany({
          where: { providerCheckoutId: event.data.checkoutId, status: 'OPEN' },
          data: { status: 'CANCELED' },
        });
        return;
      }

      case 'invoice.paid': {
        const { data } = event;
        const subscription = await this.findSubscription(tx, data.subscriptionId);
        const paymentBase = {
          userId: subscription.userId,
          subscriptionId: subscription.id,
          provider,
          providerPaymentId: data.paymentId,
          amount: data.amount,
          currency: data.currency,
        };
        if (subscription.status === 'EXPIRED') {
          await this.recordPayment(tx, { ...paymentBase, status: 'SUCCEEDED' });
          effects.refunds.push(data.paymentId);
          return;
        }
        const renewed = await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'ACTIVE',
            currentPeriodStart: new Date(data.periodStart),
            currentPeriodEnd: new Date(data.periodEnd),
            graceUntil: null,
            expiringNotifiedAt: null,
          },
          include: { plan: true },
        });
        const payment = await this.recordPayment(tx, { ...paymentBase, status: 'SUCCEEDED' });
        effects.events.push(
          { name: DomainEvent.SUBSCRIPTION_RENEWED, payload: subscriptionEvent(renewed) },
          { name: DomainEvent.PAYMENT_SUCCEEDED, payload: this.paymentEvent(payment, renewed.id, renewed.plan.name) },
        );
        return;
      }

      case 'invoice.payment_failed': {
        const { data } = event;
        const subscription = await this.findSubscription(tx, data.subscriptionId);
        if (subscription.status === 'ACTIVE') {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: { status: 'PAST_DUE', graceUntil: new Date(now.getTime() + GRACE_PERIOD_DAYS * DAY_MS) },
          });
        }
        const payment = await this.recordPayment(tx, {
          userId: subscription.userId,
          subscriptionId: subscription.id,
          provider,
          providerPaymentId: data.paymentId,
          amount: data.amount,
          currency: data.currency,
          status: 'FAILED',
          failureReason: data.reason,
        });
        if (subscription.status !== 'EXPIRED') {
          effects.events.push({
            name: DomainEvent.PAYMENT_FAILED,
            payload: { ...this.paymentEvent(payment, subscription.id, subscription.plan.name), reason: data.reason },
          });
        }
        return;
      }

      case 'subscription.canceled': {
        const subscription = await this.findSubscription(tx, event.data.subscriptionId);
        if (subscription.status === 'EXPIRED') return;
        if (event.data.atPeriodEnd) {
          const updated = await tx.subscription.update({
            where: { id: subscription.id },
            data: { cancelAtPeriodEnd: true, canceledAt: now },
            include: { plan: true },
          });
          effects.events.push({ name: DomainEvent.SUBSCRIPTION_CANCELLED, payload: subscriptionEvent(updated) });
        } else {
          effects.events.push({ name: DomainEvent.SUBSCRIPTION_CANCELLED, payload: subscriptionEvent(subscription) });
          await this.expire(tx, subscription, now, effects);
        }
        return;
      }

      case 'subscription.expired': {
        const subscription = await this.findSubscription(tx, event.data.subscriptionId);
        await this.expire(tx, subscription, now, effects);
        return;
      }

      case 'payment.refunded': {
        const payment = await tx.payment.findUnique({
          where: { provider_providerPaymentId: { provider, providerPaymentId: event.data.paymentId } },
          include: { checkoutSession: true },
        });
        if (!payment || payment.status === 'REFUNDED') return;
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED', refundedAt: now } });
        // İade edilen tek seferlik paketin kullanılmamış hakları geri alınır.
        if (payment.checkoutSession?.kind === 'PRODUCT') {
          await tx.entitlement.updateMany({
            where: { userId: payment.userId, grantKey: `checkout:${payment.checkoutSession.id}` },
            data: { quantity: 0 },
          });
        }
        const refunded: PaymentRefundedEvent = {
          paymentId: payment.id,
          userId: payment.userId,
          amount: payment.amount,
          currency: payment.currency,
        };
        effects.events.push({ name: DomainEvent.PAYMENT_REFUNDED, payload: refunded });
        return;
      }
    }
  }

  private isStillLive(subscription: Subscription, now: Date): boolean {
    return subscription.status === 'ACTIVE'
      ? subscription.currentPeriodEnd > now
      : (subscription.graceUntil ?? now) > now;
  }

  private async findSubscription(tx: DbClient, providerSubscriptionId: string): Promise<SubscriptionWithPlan> {
    const subscription = await tx.subscription.findUnique({
      where: { provider_providerSubscriptionId: { provider: this.provider.name, providerSubscriptionId } },
      include: { plan: true },
    });
    if (!subscription) throw new Error(`Bilinmeyen abonelik: ${providerSubscriptionId}`);
    return subscription;
  }

  private recordPayment(
    tx: DbClient,
    data: Prisma.PaymentUncheckedCreateInput,
  ): Promise<{ id: string; userId: string; amount: number; currency: string }> {
    return tx.payment.upsert({
      where: { provider_providerPaymentId: { provider: data.provider, providerPaymentId: data.providerPaymentId } },
      create: data,
      update: {},
      select: { id: true, userId: true, amount: true, currency: true },
    });
  }

  private paymentEvent(
    payment: { id: string; userId: string; amount: number; currency: string },
    subscriptionId: string | null,
    planName: string | null,
  ): PaymentEventPayload {
    return {
      paymentId: payment.id,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      subscriptionId,
      planName,
    };
  }

  private async expire(tx: DbClient, subscription: SubscriptionWithPlan, now: Date, effects: Effects): Promise<void> {
    const updated = await tx.subscription.updateMany({
      where: { id: subscription.id, status: { not: 'EXPIRED' } },
      data: { status: 'EXPIRED', endedAt: now },
    });
    if (updated.count === 0) return;
    await this.entitlements.revokeSubscriptionGrants(tx, subscription.id);
    await tx.userProfile.updateMany({ where: { userId: subscription.userId }, data: { incognito: false } });
    effects.events.push({ name: DomainEvent.SUBSCRIPTION_EXPIRED, payload: subscriptionEvent(subscription) });
  }

  /**
   * Zamanlanmış bakım (BullMQ): iptal edilmiş aboneliğe bitiş hatırlatması ve
   * dönemi/grace period'u biten abonelikleri kapatma.
   */
  async runMaintenance(now = new Date()): Promise<{ expiring: number; expired: number }> {
    const effects: Effects = { events: [], refunds: [] };

    const expiring = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
        expiringNotifiedAt: null,
        currentPeriodEnd: { gt: now, lte: new Date(now.getTime() + EXPIRING_NOTICE_DAYS * DAY_MS) },
      },
      include: { plan: true },
      take: 500,
    });
    let expiringCount = 0;
    for (const subscription of expiring) {
      const claimed = await this.prisma.subscription.updateMany({
        where: { id: subscription.id, expiringNotifiedAt: null },
        data: { expiringNotifiedAt: now },
      });
      if (claimed.count === 0) continue;
      expiringCount += 1;
      effects.events.push({ name: DomainEvent.SUBSCRIPTION_EXPIRING, payload: subscriptionEvent(subscription) });
    }

    const due = await this.prisma.subscription.findMany({
      where: {
        OR: [
          { status: 'ACTIVE', cancelAtPeriodEnd: true, currentPeriodEnd: { lte: now } },
          { status: 'ACTIVE', currentPeriodEnd: { lte: new Date(now.getTime() - RENEWAL_WEBHOOK_LEEWAY_MS) } },
          { status: 'PAST_DUE', graceUntil: { lte: now } },
        ],
      },
      include: { plan: true },
      take: 500,
    });
    for (const subscription of due) {
      await this.prisma.$transaction((tx) => this.expire(tx, subscription, now, effects));
    }

    this.flush(effects);
    return { expiring: expiringCount, expired: due.length };
  }
}

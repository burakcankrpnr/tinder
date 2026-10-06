import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ApiEnv } from '@dating/config';
import type { CheckoutSession, Product, SubscriptionPlan } from '@dating/database';
import type { CheckoutDto, EntitlementsDto, MockCheckoutDto, PaymentDto } from '@dating/types';
import type { CheckoutInput, MockCheckoutOutcome, MockSimulationEvent } from '@dating/validation';
import { type CheckoutStartedEvent, DomainEvent } from '../../common/events/domain-events';
import { AppException } from '../../common/http/app.exception';
import { ENV } from '../../config/env.module';
import { isUniqueViolation } from '../../infra/prisma/prisma-errors';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CatalogService } from './catalog.service';
import { EntitlementsService } from './entitlements.service';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentProvider } from './payment-provider';
import { LIVE_STATUSES } from './subscription.mapper';

const CHECKOUT_TTL_MS = 30 * 60 * 1000;
const PAYMENT_HISTORY_LIMIT = 50;
const INTERVAL_LABELS = { MONTHLY: 'aylık', YEARLY: 'yıllık' } as const;

type SessionWithTarget = CheckoutSession & { plan: SubscriptionPlan | null; product: Product | null };

function describe(session: SessionWithTarget): string {
  if (session.plan && session.interval) return `${session.plan.name} (${INTERVAL_LABELS[session.interval]})`;
  if (session.product) return session.product.name;
  return 'Ödeme';
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly entitlements: EntitlementsService,
    private readonly provider: PaymentProvider,
    private readonly events: EventEmitter2,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  /**
   * Checkout başlatır. Fiyat her zaman backend'deki paketten gelir; client tutar gönderemez.
   * Aynı `Idempotency-Key` ile tekrar gelen istek yeni oturum açmaz, ilkini döner.
   */
  async checkout(userId: string, input: CheckoutInput, idempotencyKey: string): Promise<CheckoutDto> {
    const existing = await this.findByIdempotencyKey(userId, idempotencyKey);
    if (existing) return this.replay(existing, input);

    const target =
      input.kind === 'SUBSCRIPTION'
        ? await this.subscriptionTarget(userId, input.planSlug, input.interval)
        : await this.productTarget(input.productSlug);

    let session: CheckoutSession;
    try {
      session = await this.prisma.checkoutSession.create({
        data: {
          userId,
          kind: input.kind,
          provider: this.provider.name,
          idempotencyKey,
          expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
          ...target.data,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await this.findByIdempotencyKey(userId, idempotencyKey);
      if (!raced) throw error;
      return this.replay(raced, input);
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true } });
    const result = await this.provider.createCheckout({
      checkoutSessionId: session.id,
      customerId: await this.provider.createCustomer(user),
      amount: session.amount,
      currency: session.currency,
      description: target.description,
      mode: input.kind === 'SUBSCRIPTION' ? 'subscription' : 'payment',
      interval: session.interval,
    });
    await this.prisma.checkoutSession.update({
      where: { id: session.id },
      data: { providerCheckoutId: result.providerCheckoutId },
    });

    const event: CheckoutStartedEvent = {
      userId,
      checkoutSessionId: session.id,
      kind: input.kind,
      target: input.kind === 'SUBSCRIPTION' ? input.planSlug : input.productSlug,
      amount: session.amount,
    };
    this.events.emit(DomainEvent.CHECKOUT_STARTED, event);
    return { checkoutId: session.id, url: result.url };
  }

  private findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<SessionWithTarget | null> {
    return this.prisma.checkoutSession.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: { plan: true, product: true },
    });
  }

  private replay(session: SessionWithTarget, input: CheckoutInput): CheckoutDto {
    const sameRequest =
      input.kind === 'SUBSCRIPTION'
        ? session.plan?.slug === input.planSlug && session.interval === input.interval
        : session.product?.slug === input.productSlug;
    if (!sameRequest) {
      throw new AppException(
        'CONFLICT',
        'Bu Idempotency-Key farklı bir istek için kullanılmış.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (!session.providerCheckoutId) {
      throw new AppException('CONFLICT', 'Ödeme hazırlanıyor, birazdan tekrar dene.', HttpStatus.CONFLICT);
    }
    return { checkoutId: session.id, url: this.provider.checkoutUrl(session.providerCheckoutId) };
  }

  private async subscriptionTarget(userId: string, planSlug: string, interval: 'MONTHLY' | 'YEARLY') {
    const [plan, active] = await Promise.all([
      this.catalog.purchasablePlan(planSlug),
      this.entitlements.activeSubscription(userId),
    ]);
    if (active) {
      throw new AppException(
        'CONFLICT',
        'Zaten aktif bir aboneliğin var. Paket değiştirmek için önce mevcut aboneliğinin bitmesini bekle.',
        HttpStatus.CONFLICT,
      );
    }
    return {
      description: `${plan.name} (${INTERVAL_LABELS[interval]})`,
      data: {
        planId: plan.id,
        interval,
        amount: interval === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice,
        currency: plan.currency,
      },
    };
  }

  private async productTarget(productSlug: string) {
    const product = await this.catalog.purchasableProduct(productSlug);
    return {
      description: product.name,
      data: { productId: product.id, amount: product.price, currency: product.currency },
    };
  }

  /** Kullanıcı iptal eder; durum provider'ın `subscription.canceled` webhook'u ile güncellenir. */
  async cancel(userId: string): Promise<EntitlementsDto> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: [...LIVE_STATUSES] } },
    });
    if (!subscription) throw AppException.notFound('Aktif aboneliğin yok.');
    if (!subscription.cancelAtPeriodEnd) {
      await this.provider.cancelSubscription(subscription.providerSubscriptionId, { atPeriodEnd: true });
    }
    return this.entitlements.summary(userId);
  }

  async payments(userId: string): Promise<PaymentDto[]> {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: PAYMENT_HISTORY_LIMIT,
      include: {
        checkoutSession: { include: { plan: true, product: true } },
        subscription: { include: { plan: true } },
      },
    });
    return payments.map((payment) => ({
      id: payment.id,
      description: payment.checkoutSession
        ? describe(payment.checkoutSession)
        : payment.subscription
          ? `${payment.subscription.plan.name} yenileme`
          : 'Ödeme',
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt.toISOString(),
    }));
  }

  get mockEnabled(): boolean {
    return this.provider instanceof MockPaymentProvider && this.env.NODE_ENV !== 'production';
  }

  private mockProvider(): MockPaymentProvider {
    if (!this.mockEnabled || !(this.provider instanceof MockPaymentProvider)) {
      throw AppException.notFound('Bu ortamda mock ödeme kullanılamaz.');
    }
    return this.provider;
  }

  async mockCheckout(userId: string, providerCheckoutId: string): Promise<MockCheckoutDto> {
    this.mockProvider();
    const session = await this.prisma.checkoutSession.findUnique({
      where: { providerCheckoutId },
      include: { plan: true, product: true },
    });
    if (!session || session.userId !== userId) throw AppException.notFound('Ödeme oturumu bulunamadı.');
    const expired = session.status === 'OPEN' && session.expiresAt <= new Date();
    return {
      checkoutId: providerCheckoutId,
      status: expired ? 'EXPIRED' : session.status,
      description: describe(session),
      amount: session.amount,
      currency: session.currency,
    };
  }

  async completeMockCheckout(
    userId: string,
    providerCheckoutId: string,
    outcome: MockCheckoutOutcome,
  ): Promise<MockCheckoutDto> {
    const provider = this.mockProvider();
    const current = await this.mockCheckout(userId, providerCheckoutId);
    if (current.status !== 'OPEN') {
      throw new AppException('CONFLICT', 'Bu ödeme oturumu artık açık değil.', HttpStatus.CONFLICT);
    }
    await provider.completeCheckout(providerCheckoutId, outcome);
    return this.mockCheckout(userId, providerCheckoutId);
  }

  async simulate(userId: string, event: MockSimulationEvent): Promise<EntitlementsDto> {
    const provider = this.mockProvider();
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: [...LIVE_STATUSES] } },
    });
    if (!subscription) throw AppException.notFound('Aktif aboneliğin yok.');
    await provider.simulate(subscription.providerSubscriptionId, event);
    return this.entitlements.summary(userId);
  }
}

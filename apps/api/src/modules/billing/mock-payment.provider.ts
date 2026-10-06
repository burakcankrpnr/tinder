import { randomBytes, randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { BillingInterval } from '@dating/types';
import type { MockCheckoutOutcome, MockSimulationEvent } from '@dating/validation';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import {
  type CheckoutRequest,
  type CheckoutResult,
  PaymentProvider,
  type ProviderEvent,
  type ProviderSubscription,
  type WebhookHeaders,
  providerEventSchema,
} from './payment-provider';
import { periodEnd } from './periods';
import { signPayload, verifySignature } from './webhook-signature';

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

export type WebhookSink = (rawBody: Buffer, headers: WebhookHeaders) => Promise<unknown>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function mockId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}

function header(headers: WebhookHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Geliştirme/test için sahte ödeme sağlayıcısı. Gerçek bir provider gibi davranır:
 * ödeme sonucu yalnızca imzalı webhook olarak gelir ve gerçek webhook doğrulama yolundan geçer.
 * Durumu tutmak için kendi deposu yerine uygulama DB'sini yalnızca okur.
 */
export class MockPaymentProvider extends PaymentProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockPaymentProvider.name);
  private sink: WebhookSink | null = null;

  constructor(
    private readonly secret: string,
    private readonly appUrl: string,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  /** Webhook teslim hedefi; production provider'larda bunun yerine HTTP çağrısı gelir. */
  connect(sink: WebhookSink): void {
    this.sink = sink;
  }

  async createCustomer(user: { id: string }): Promise<string> {
    return `mock_cus_${user.id}`;
  }

  async createCheckout(_request: CheckoutRequest): Promise<CheckoutResult> {
    const providerCheckoutId = mockId('mock_cs');
    return { providerCheckoutId, url: this.checkoutUrl(providerCheckoutId) };
  }

  checkoutUrl(providerCheckoutId: string): string {
    return new URL(`/checkout/mock/${providerCheckoutId}`, this.appUrl).toString();
  }

  async createSubscription(input: { interval: BillingInterval; start: Date }): Promise<ProviderSubscription> {
    return {
      id: mockId('mock_sub'),
      status: 'active',
      currentPeriodStart: input.start,
      currentPeriodEnd: periodEnd(input.start, input.interval),
      cancelAtPeriodEnd: false,
    };
  }

  async cancelSubscription(providerSubscriptionId: string, options: { atPeriodEnd: boolean }): Promise<void> {
    await this.deliver({
      type: 'subscription.canceled',
      data: { subscriptionId: providerSubscriptionId, atPeriodEnd: options.atPeriodEnd },
    });
  }

  async refund(providerPaymentId: string): Promise<void> {
    await this.deliver({ type: 'payment.refunded', data: { paymentId: providerPaymentId } });
  }

  verifyWebhook(rawBody: Buffer, headers: WebhookHeaders): ProviderEvent | null {
    const payload = rawBody.toString('utf8');
    if (!verifySignature(this.secret, payload, header(headers, MOCK_SIGNATURE_HEADER))) return null;
    try {
      const parsed = providerEventSchema.safeParse(JSON.parse(payload));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription | null> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { provider: this.name, providerSubscriptionId },
    });
    if (!subscription) return null;
    return {
      id: providerSubscriptionId,
      status:
        subscription.status === 'EXPIRED' ? 'expired' : subscription.status === 'PAST_DUE' ? 'past_due' : 'active',
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }

  /** Mock ödeme sayfasındaki "Öde / Başarısız / Vazgeç" butonları. */
  async completeCheckout(providerCheckoutId: string, outcome: MockCheckoutOutcome): Promise<void> {
    const session = await this.prisma.checkoutSession.findUniqueOrThrow({ where: { providerCheckoutId } });
    if (outcome === 'cancel') {
      await this.deliver({ type: 'checkout.canceled', data: { checkoutId: providerCheckoutId } });
      return;
    }
    const payment = { paymentId: mockId('mock_pay'), amount: session.amount, currency: session.currency };
    if (outcome === 'fail') {
      await this.deliver({
        type: 'checkout.failed',
        data: { checkoutId: providerCheckoutId, ...payment, reason: 'Kart reddedildi (mock)' },
      });
      return;
    }
    const subscription =
      session.kind === 'SUBSCRIPTION' && session.interval
        ? await this.createSubscription({ interval: session.interval, start: new Date() })
        : null;
    await this.deliver({
      type: 'checkout.completed',
      data: {
        checkoutId: providerCheckoutId,
        customerId: await this.createCustomer({ id: session.userId }),
        ...payment,
        ...(subscription && {
          subscription: {
            id: subscription.id,
            periodStart: subscription.currentPeriodStart.toISOString(),
            periodEnd: subscription.currentPeriodEnd.toISOString(),
          },
        }),
      },
    });
  }

  /** Yenileme / ödeme hatası / sona erme senaryolarını demo ve testler için tetikler. */
  async simulate(providerSubscriptionId: string, event: MockSimulationEvent): Promise<void> {
    const subscription = await this.prisma.subscription.findFirstOrThrow({
      where: { provider: this.name, providerSubscriptionId },
      include: { plan: true },
    });
    const amount = subscription.interval === 'MONTHLY' ? subscription.plan.monthlyPrice : subscription.plan.yearlyPrice;
    const money = { paymentId: mockId('mock_pay'), amount, currency: subscription.plan.currency };

    if (event === 'renew') {
      const now = new Date();
      const start = subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
      await this.deliver({
        type: 'invoice.paid',
        data: {
          subscriptionId: providerSubscriptionId,
          ...money,
          periodStart: start.toISOString(),
          periodEnd: periodEnd(start, subscription.interval).toISOString(),
        },
      });
    } else if (event === 'payment_failed') {
      await this.deliver({
        type: 'invoice.payment_failed',
        data: { subscriptionId: providerSubscriptionId, ...money, reason: 'Yetersiz bakiye (mock)' },
      });
    } else {
      await this.deliver({ type: 'subscription.expired', data: { subscriptionId: providerSubscriptionId } });
    }
  }

  private async deliver(event: DistributiveOmit<ProviderEvent, 'id'>): Promise<void> {
    if (!this.sink) throw new Error('Mock payment provider webhook hedefi bağlanmadı');
    const payload = JSON.stringify({ id: `evt_${randomUUID()}`, ...event });
    this.logger.debug({ type: event.type }, 'Mock webhook gönderiliyor');
    await this.sink(Buffer.from(payload, 'utf8'), { [MOCK_SIGNATURE_HEADER]: signPayload(this.secret, payload) });
  }
}

import type { BillingInterval } from '@dating/types';
import { z } from 'zod';

/**
 * Sağlayıcıdan bağımsız, normalize edilmiş webhook event'leri.
 * Her provider kendi formatını doğrulayıp bu şekle çevirir; billing yalnızca bunları bilir.
 */
const isoDate = z.iso.datetime({ offset: true });
const money = { amount: z.number().int().nonnegative(), currency: z.string().length(3) };

export const providerEventSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    type: z.literal('checkout.completed'),
    data: z.object({
      checkoutId: z.string().min(1),
      paymentId: z.string().min(1),
      customerId: z.string().min(1),
      ...money,
      subscription: z
        .object({ id: z.string().min(1), periodStart: isoDate, periodEnd: isoDate })
        .optional(),
    }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('checkout.failed'),
    data: z.object({ checkoutId: z.string().min(1), paymentId: z.string().min(1), ...money, reason: z.string() }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('checkout.canceled'),
    data: z.object({ checkoutId: z.string().min(1) }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('invoice.paid'),
    data: z.object({
      subscriptionId: z.string().min(1),
      paymentId: z.string().min(1),
      ...money,
      periodStart: isoDate,
      periodEnd: isoDate,
    }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('invoice.payment_failed'),
    data: z.object({ subscriptionId: z.string().min(1), paymentId: z.string().min(1), ...money, reason: z.string() }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('subscription.canceled'),
    data: z.object({ subscriptionId: z.string().min(1), atPeriodEnd: z.boolean() }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('subscription.expired'),
    data: z.object({ subscriptionId: z.string().min(1) }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('payment.refunded'),
    data: z.object({ paymentId: z.string().min(1) }),
  }),
]);

export type ProviderEvent = z.infer<typeof providerEventSchema>;

export interface CheckoutRequest {
  checkoutSessionId: string;
  customerId: string;
  amount: number;
  currency: string;
  description: string;
  mode: 'subscription' | 'payment';
  interval: BillingInterval | null;
}

export interface CheckoutResult {
  providerCheckoutId: string;
  url: string;
}

export interface ProviderSubscription {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'expired';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export type WebhookHeaders = Record<string, string | string[] | undefined>;

/** Spec Bölüm 13: sağlayıcı değişirse yalnızca bu sınıfın yeni bir implementasyonu yazılır. */
export abstract class PaymentProvider {
  abstract readonly name: string;

  abstract createCustomer(user: { id: string; email: string }): Promise<string>;
  abstract createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  abstract checkoutUrl(providerCheckoutId: string): string;
  abstract createSubscription(input: {
    customerId: string;
    interval: BillingInterval;
    start: Date;
  }): Promise<ProviderSubscription>;
  abstract cancelSubscription(providerSubscriptionId: string, options: { atPeriodEnd: boolean }): Promise<void>;
  abstract refund(providerPaymentId: string): Promise<void>;
  /** İmza geçersizse `null`; geçerliyse normalize edilmiş event. */
  abstract verifyWebhook(rawBody: Buffer, headers: WebhookHeaders): ProviderEvent | null;
  abstract getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription | null>;
}

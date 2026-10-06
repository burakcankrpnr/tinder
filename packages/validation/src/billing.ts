import { z } from 'zod';
import { findKnownCity } from './cities';
import { RELATIONSHIP_INTENTIONS } from './profile';

export const BILLING_INTERVALS = ['MONTHLY', 'YEARLY'] as const;
export const PAYMENT_PROVIDERS = ['mock'] as const;

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9-]+$/, 'Geçersiz paket.');

export const checkoutSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('SUBSCRIPTION'), planSlug: slugSchema, interval: z.enum(BILLING_INTERVALS) }),
  z.object({ kind: z.literal('PRODUCT'), productSlug: slugSchema }),
]);

/** `Idempotency-Key` header'ı: aynı anahtarla tekrar gelen istek aynı sonucu döner. */
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/, 'Geçersiz Idempotency-Key.');

export const providerParamSchema = z.object({ provider: z.enum(PAYMENT_PROVIDERS) });
export const checkoutIdParamSchema = z.object({
  checkoutId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export const mockCheckoutOutcomeSchema = z.object({ outcome: z.enum(['success', 'fail', 'cancel']) });
export const mockSimulationSchema = z.object({ event: z.enum(['renew', 'payment_failed', 'expire']) });

export const premiumSettingsSchema = z
  .object({
    incognito: z.boolean(),
    passportCity: z
      .string()
      .trim()
      .max(80)
      .nullable()
      .refine((city) => city === null || findKnownCity(city) !== undefined, 'Bu şehir Passport için desteklenmiyor.'),
    verifiedOnly: z.boolean(),
    intentions: z
      .array(z.enum(RELATIONSHIP_INTENTIONS))
      .max(RELATIONSHIP_INTENTIONS.length)
      .transform((values) => [...new Set(values)]),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'En az bir ayar gönder.' });

export type BillingInterval = (typeof BILLING_INTERVALS)[number];
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type MockCheckoutOutcome = z.infer<typeof mockCheckoutOutcomeSchema>['outcome'];
export type MockSimulationEvent = z.infer<typeof mockSimulationSchema>['event'];
export type PremiumSettingsInput = z.infer<typeof premiumSettingsSchema>;

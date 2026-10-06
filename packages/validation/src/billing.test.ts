import { describe, expect, it } from 'vitest';
import { checkoutSchema, idempotencyKeySchema, premiumSettingsSchema } from './billing';
import { findKnownCity } from './cities';

describe('billing validation', () => {
  it('accepts subscription and product checkouts but never a client amount', () => {
    expect(checkoutSchema.parse({ kind: 'SUBSCRIPTION', planSlug: 'premium', interval: 'YEARLY' })).toEqual({
      kind: 'SUBSCRIPTION',
      planSlug: 'premium',
      interval: 'YEARLY',
    });
    expect(checkoutSchema.parse({ kind: 'PRODUCT', productSlug: 'boost-5', amount: 1 })).toEqual({
      kind: 'PRODUCT',
      productSlug: 'boost-5',
    });
    expect(checkoutSchema.safeParse({ kind: 'SUBSCRIPTION', planSlug: 'premium' }).success).toBe(false);
    expect(checkoutSchema.safeParse({ kind: 'PRODUCT', productSlug: 'Boost 5' }).success).toBe(false);
  });

  it('validates idempotency keys', () => {
    expect(idempotencyKeySchema.safeParse('3f0c1d8e-1b2a-4c5d-8e9f-0a1b2c3d4e5f').success).toBe(true);
    expect(idempotencyKeySchema.safeParse('short').success).toBe(false);
    expect(idempotencyKeySchema.safeParse('has spaces in it').success).toBe(false);
  });

  it('validates premium settings', () => {
    expect(premiumSettingsSchema.safeParse({}).success).toBe(false);
    expect(premiumSettingsSchema.parse({ passportCity: 'izmir', intentions: ['LONG_TERM', 'LONG_TERM'] })).toEqual({
      passportCity: 'izmir',
      intentions: ['LONG_TERM'],
    });
    expect(premiumSettingsSchema.parse({ passportCity: null })).toEqual({ passportCity: null });
    expect(premiumSettingsSchema.safeParse({ passportCity: 'Atlantis' }).success).toBe(false);
  });

  it('matches known cities without diacritics', () => {
    expect(findKnownCity('ISTANBUL')?.name).toBe('İstanbul');
    expect(findKnownCity('diyarbakir')?.name).toBe('Diyarbakır');
    expect(findKnownCity('Atlantis')).toBeUndefined();
  });
});

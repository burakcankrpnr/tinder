'use client';

import type { BillingInterval, PlanDto } from '@dating/types';
import { Alert, Button, Spinner, cx } from '@dating/ui';
import { useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { INTERVAL_LABELS, formatPrice, monthlyEquivalent, useCatalog, useEntitlements, useStartCheckout } from '@/lib/billing';

function IntervalToggle({
  value,
  onChange,
  savings,
}: {
  value: BillingInterval;
  onChange: (value: BillingInterval) => void;
  savings: number;
}) {
  return (
    <div role="radiogroup" aria-label="Ödeme dönemi" className="bg-surface-2 mx-auto flex w-fit rounded-full p-1">
      {(['MONTHLY', 'YEARLY'] as const).map((interval) => (
        <button
          key={interval}
          type="button"
          role="radio"
          aria-checked={value === interval}
          onClick={() => onChange(interval)}
          className={cx(
            'focus-visible:outline-primary rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-2',
            value === interval ? 'bg-primary-strong text-text' : 'text-text-muted hover:text-text',
          )}
        >
          {INTERVAL_LABELS[interval]}
          {interval === 'YEARLY' && savings > 0 && (
            <span className="bg-success/20 text-success ml-2 rounded-full px-2 py-0.5 text-xs">%{savings} tasarruf</span>
          )}
        </button>
      ))}
    </div>
  );
}

function PlanPrice({ plan, interval }: { plan: PlanDto; interval: BillingInterval }) {
  if (plan.monthlyPrice === 0) {
    return <p className="text-3xl font-semibold">Ücretsiz</p>;
  }
  if (interval === 'MONTHLY') {
    return (
      <p>
        <span className="text-3xl font-semibold">{formatPrice(plan.monthlyPrice, plan.currency)}</span>
        <span className="text-text-muted text-sm"> / ay</span>
      </p>
    );
  }
  return (
    <div>
      <p>
        <span className="text-3xl font-semibold">{formatPrice(monthlyEquivalent(plan.yearlyPrice), plan.currency)}</span>
        <span className="text-text-muted text-sm"> / ay</span>
      </p>
      <p className="text-text-muted text-xs">Yıllık {formatPrice(plan.yearlyPrice, plan.currency)} tek ödeme</p>
    </div>
  );
}

/**
 * Free vs Plus vs Premium karşılaştırması (spec Bölüm 38). Fiyat ve özellikler backend'den gelir.
 * `public` modda CTA kayıt sayfasına, `app` modda checkout'a gider.
 */
export function PlanComparison({ mode, highlight = 'premium' }: { mode: 'public' | 'app'; highlight?: string }) {
  const catalog = useCatalog();
  const entitlements = useEntitlements();
  const checkout = useStartCheckout();
  const [interval, setBillingInterval] = useState<BillingInterval>('YEARLY');

  if (catalog.isPending) {
    return (
      <div className="text-primary flex justify-center py-10">
        <Spinner className="size-7" label="Paketler yükleniyor" />
      </div>
    );
  }
  if (catalog.isError) return <Alert tone="danger">{errorMessage(catalog.error)}</Alert>;

  const plans = catalog.data.plans;
  const savings = Math.max(0, ...plans.map((plan) => plan.yearlySavingsPercent));
  const currentSlug = mode === 'app' ? entitlements.data?.plan.slug : undefined;
  const hasSubscription = mode === 'app' && entitlements.data?.subscription != null;

  return (
    <div className="space-y-5">
      <IntervalToggle value={interval} onChange={setBillingInterval} savings={savings} />
      {checkout.isError && <Alert tone="danger">{errorMessage(checkout.error)}</Alert>}
      <ul className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const featured = plan.slug === highlight;
          const current = plan.slug === currentSlug;
          const pending = checkout.isPending && checkout.variables?.kind === 'SUBSCRIPTION' && checkout.variables.planSlug === plan.slug;
          return (
            <li
              key={plan.slug}
              className={cx(
                'bg-surface text-text flex flex-col gap-4 rounded-card border p-5',
                featured ? 'border-primary shadow-primary-strong/20 shadow-xl' : 'border-text/10',
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {current ? (
                    <span className="bg-primary/20 text-primary-soft rounded-full px-2 py-0.5 text-xs">Mevcut paket</span>
                  ) : featured ? (
                    <span className="bg-accent-gradient rounded-full px-2 py-0.5 text-xs font-semibold">En popüler</span>
                  ) : null}
                </div>
                {plan.description && <p className="text-text-muted text-sm">{plan.description}</p>}
              </div>
              <PlanPrice plan={plan} interval={interval} />
              <ul className="flex-1 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden className="text-success">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.monthlyPrice === 0 ? null : mode === 'public' ? (
                <p className="text-text-muted text-center text-sm">Abonelik uygulamada yönetilir.</p>
              ) : (
                <Button
                  variant={featured ? 'primary' : 'secondary'}
                  fullWidth
                  loading={pending}
                  disabled={current || hasSubscription || checkout.isPending}
                  onClick={() => checkout.mutate({ kind: 'SUBSCRIPTION', planSlug: plan.slug, interval })}
                >
                  {current ? 'Aktif' : `${plan.name}’a geç`}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {hasSubscription && (
        <p className="text-text-muted text-center text-xs">
          Paket değiştirmek için mevcut aboneliğinin bitmesini bekleyebilirsin.
        </p>
      )}
    </div>
  );
}

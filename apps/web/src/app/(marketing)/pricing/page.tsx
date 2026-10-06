import type { Metadata } from 'next';
import { PlanComparison } from '@/components/billing/plan-comparison';

export const metadata: Metadata = {
  title: 'Fiyatlar',
  description: 'Free, Plus ve Premium paketlerini karşılaştır.',
};

export default function PricingPage() {
  return (
    <div className="space-y-8">
      <div className="subpage-intro mx-auto max-w-2xl space-y-2 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Sana uygun paketi seç</h1>
        <p className="text-text-muted">
          Ücretsiz başla, istediğinde yükselt. Abonelikler istediğin zaman iptal edilebilir; dönem sonuna kadar açık kalır.
        </p>
      </div>
      <PlanComparison mode="public" />
    </div>
  );
}

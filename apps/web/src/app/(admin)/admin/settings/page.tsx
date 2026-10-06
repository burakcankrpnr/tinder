'use client';

import { Button, Field, Input } from '@dating/ui';
import { useState } from 'react';
import { AdminLoad, LoadMore } from '../_components';
import { api, errorMessage } from '@/lib/api-client';
import { useAdminAudit, useAdminFlags, useAdminPlans, useInvalidateAdmin } from '@/lib/admin';
import { formatPrice } from '@/lib/billing';
import { formatDate } from '@/lib/format';

export default function AdminSettingsPage() {
  const plans = useAdminPlans();
  const flags = useAdminFlags();
  const audit = useAdminAudit({});
  const invalidate = useInvalidateAdmin();
  const [error, setError] = useState<string | null>(null);
  const [flagKey, setFlagKey] = useState('');
  const [flagDescription, setFlagDescription] = useState('');

  const run = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
      await invalidate();
    } catch (problem) {
      setError(errorMessage(problem));
    }
  };

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Ayarlar</h1>
      {error && <p className="text-danger text-sm">{error}</p>}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Paketler</h2>
        <AdminLoad pending={plans.isPending} error={plans.error}>
          <ul className="space-y-3">
            {(plans.data ?? []).map((plan) => (
              <li key={plan.id} className="bg-surface/80 rounded-card border-text/5 flex flex-wrap items-center justify-between gap-3 border p-4">
                <div>
                  <p className="font-medium">{plan.name}</p>
                  <p className="text-text-muted text-sm">
                    {formatPrice(plan.monthlyPrice, plan.currency)} / ay · {plan.activeSubscribers} abone
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void run(() =>
                      api(`/admin/plans/${plan.id}`, { method: 'PATCH', body: { active: !plan.active } }),
                    )
                  }
                >
                  {plan.active ? 'Pasifleştir' : 'Aktifleştir'}
                </Button>
              </li>
            ))}
          </ul>
        </AdminLoad>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Özellik bayrakları</h2>
        <AdminLoad pending={flags.isPending} error={flags.error}>
          <ul className="space-y-3">
            {(flags.data ?? []).map((flag) => (
              <li key={flag.key} className="bg-surface/80 rounded-card border-text/5 flex flex-wrap items-center justify-between gap-3 border p-4">
                <div>
                  <p className="font-medium">{flag.key}</p>
                  <p className="text-text-muted text-sm">
                    {flag.description} · %{flag.rolloutPercent}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={flag.enabled ? 'secondary' : 'primary'}
                  onClick={() =>
                    void run(() =>
                      api(`/admin/feature-flags/${flag.key}`, {
                        method: 'PATCH',
                        body: { enabled: !flag.enabled },
                      }),
                    )
                  }
                >
                  {flag.enabled ? 'Kapat' : 'Aç'}
                </Button>
              </li>
            ))}
          </ul>
        </AdminLoad>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await api('/admin/feature-flags', {
                method: 'POST',
                body: { key: flagKey, description: flagDescription, enabled: false, rolloutPercent: 100 },
              });
              setFlagKey('');
              setFlagDescription('');
            });
          }}
        >
          <Field label="Anahtar">
            <Input value={flagKey} onChange={(event) => setFlagKey(event.target.value.toUpperCase())} placeholder="BOOST_V2" />
          </Field>
          <Field label="Açıklama">
            <Input value={flagDescription} onChange={(event) => setFlagDescription(event.target.value)} />
          </Field>
          <Button type="submit" disabled={flagKey.length < 3 || flagDescription.length < 3}>
            Ekle
          </Button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Denetim kaydı</h2>
        <AdminLoad pending={audit.isPending} error={audit.error}>
          <ul className="space-y-2 text-sm">
            {(audit.data?.pages.flatMap((page) => page.items) ?? []).map((entry) => (
              <li key={entry.id} className="border-text/5 border-b py-2">
                <span className="text-text-muted">{formatDate(entry.createdAt)}</span> · {entry.action}
                {entry.actor && <span className="text-text-muted"> · {entry.actor.email}</span>}
              </li>
            ))}
          </ul>
          <LoadMore hasNext={Boolean(audit.hasNextPage)} loading={audit.isFetchingNextPage} onClick={() => void audit.fetchNextPage()} />
        </AdminLoad>
      </section>
    </div>
  );
}

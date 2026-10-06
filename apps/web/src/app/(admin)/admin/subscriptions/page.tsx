'use client';

import type { SubscriptionState } from '@dating/types';
import { Button, Field, Input, Select } from '@dating/ui';
import Link from 'next/link';
import { useState } from 'react';
import { AdminLoad, FilterBar, LoadMore } from '../_components';
import { api, errorMessage } from '@/lib/api-client';
import { useAdminSubscriptions, useInvalidateAdmin } from '@/lib/admin';
import { INTERVAL_LABELS } from '@/lib/billing';
import { formatDate } from '@/lib/format';

const STATES: Record<SubscriptionState, string> = {
  ACTIVE: 'Aktif',
  CANCEL_AT_PERIOD_END: 'Dönem sonunda biter',
  GRACE_PERIOD: 'Ödeme bekleniyor',
  EXPIRED: 'Sona erdi',
};

export default function AdminSubscriptionsPage() {
  const [state, setState] = useState('');
  const [reason, setReason] = useState('');
  const list = useAdminSubscriptions({ state });
  const invalidate = useInvalidateAdmin();
  const rows = list.data?.pages.flatMap((page) => page.items) ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancel = async (id: string, immediately: boolean) => {
    setBusy(id);
    setError(null);
    try {
      await api(`/admin/subscriptions/${id}/cancel`, { method: 'POST', body: { immediately, reason } });
      await invalidate();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Abonelikler</h1>
      <FilterBar>
        <Field label="Durum">
          <Select value={state} onChange={(event) => setState(event.target.value)}>
            <option value="">Tümü</option>
            {Object.entries(STATES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="İptal gerekçesi">
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </FilterBar>
      {error && <p className="text-danger text-sm">{error}</p>}
      <AdminLoad pending={list.isPending} error={list.error}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-text-muted text-xs uppercase">
              <tr>
                <th className="py-2 pr-3">Kullanıcı</th>
                <th className="py-2 pr-3">Paket</th>
                <th className="py-2 pr-3">Durum</th>
                <th className="py-2 pr-3">Bitiş</th>
                <th className="py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-text/5 border-t">
                  <td className="py-3 pr-3">
                    <Link className="text-primary" href={`/admin/users/${row.userId}`}>
                      {row.email}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">
                    {row.plan} · {INTERVAL_LABELS[row.interval]}
                  </td>
                  <td className="py-3 pr-3">{STATES[row.state]}</td>
                  <td className="py-3 pr-3">{formatDate(row.currentPeriodEnd)}</td>
                  <td className="py-3">
                    {row.state === 'ACTIVE' || row.state === 'GRACE_PERIOD' ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={reason.trim().length < 3}
                          loading={busy === row.id}
                          onClick={() => void cancel(row.id, false)}
                        >
                          Dönem sonunda
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={reason.trim().length < 3}
                          loading={busy === row.id}
                          onClick={() => void cancel(row.id, true)}
                        >
                          Hemen
                        </Button>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMore hasNext={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()} />
      </AdminLoad>
    </div>
  );
}

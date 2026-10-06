'use client';

import type { AdminPaymentStatus } from '@dating/types';
import { Button, Field, Input, Select } from '@dating/ui';
import Link from 'next/link';
import { useState } from 'react';
import { AdminLoad, FilterBar, LoadMore } from '../_components';
import { api, errorMessage } from '@/lib/api-client';
import { useAdminPayments, useInvalidateAdmin } from '@/lib/admin';
import { formatPrice } from '@/lib/billing';
import { formatDate } from '@/lib/format';

const STATUSES: Record<AdminPaymentStatus, string> = {
  SUCCEEDED: 'Başarılı',
  FAILED: 'Başarısız',
  REFUNDED: 'İade',
};

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const list = useAdminPayments({ status });
  const invalidate = useInvalidateAdmin();
  const rows = list.data?.pages.flatMap((page) => page.items) ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refund = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await api(`/admin/payments/${id}/refund`, { method: 'POST', body: { reason } });
      await invalidate();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Ödemeler</h1>
      <FilterBar>
        <Field label="Durum">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tümü</option>
            {Object.entries(STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="İade gerekçesi">
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
                <th className="py-2 pr-3">Açıklama</th>
                <th className="py-2 pr-3">Tutar</th>
                <th className="py-2 pr-3">Durum</th>
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
                  <td className="py-3 pr-3">{row.description}</td>
                  <td className="py-3 pr-3">{formatPrice(row.amount, row.currency)}</td>
                  <td className="py-3 pr-3">{STATUSES[row.status]}</td>
                  <td className="py-3">
                    {row.status === 'SUCCEEDED' ? (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={reason.trim().length < 3}
                        loading={busy === row.id}
                        onClick={() => void refund(row.id)}
                      >
                        İade
                      </Button>
                    ) : (
                      formatDate(row.createdAt)
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

'use client';

import { Alert, Button, Spinner } from '@dating/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { errorMessage } from '@/lib/api-client';
import { formatPrice } from '@/lib/billing';
import { useAdminDashboard } from '@/lib/admin';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface/80 rounded-card border-text/5 border p-4">
      <p className="text-text-muted text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Bars<T extends { date: string }>({
  data,
  value,
  format,
}: {
  data: T[];
  value: (row: T) => number;
  format: (n: number) => string;
}) {
  const max = Math.max(...data.map(value), 1);
  return (
    <ul className="flex h-40 items-end gap-1">
      {data.map((row) => (
        <li key={row.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className="bg-primary/80 w-full rounded-t"
            style={{ height: `${(value(row) / max) * 100}%` }}
            title={`${formatDate(row.date)}: ${format(value(row))}`}
          />
        </li>
      ))}
    </ul>
  );
}

export default function AdminDashboardPage() {
  const { state } = useAuth();
  const router = useRouter();
  const dashboard = useAdminDashboard(30);

  useEffect(() => {
    if (state.status === 'authenticated' && state.user.role !== 'ADMIN') {
      router.replace('/admin/users');
    }
  }, [state, router]);

  if (dashboard.isPending) {
    return (
      <div className="text-primary flex justify-center py-20">
        <Spinner className="size-8" label="Özet yükleniyor" />
      </div>
    );
  }
  if (dashboard.isError) return <Alert tone="danger">{errorMessage(dashboard.error)}</Alert>;

  const data = dashboard.data;
  const currency = data.revenue.currency;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Özet</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Kullanıcı" value={String(data.users.total)} />
        <Stat label="Aktif" value={String(data.users.active)} />
        <Stat label="Yeni (dönem)" value={String(data.users.new)} />
        <Stat label="Eşleşme" value={String(data.matches)} />
        <Stat label="Mesaj" value={String(data.messages)} />
        <Stat label="Açık rapor" value={String(data.openReports)} />
        <Stat label="Moderasyon kuyruğu" value={String(data.pendingModeration)} />
        <Stat label="Aktif abonelik" value={String(data.subscriptions.active)} />
        <Stat label="30 gün gelir" value={formatPrice(data.revenue.last30Days, currency)} />
        <Stat label="MRR" value={formatPrice(data.revenue.mrr, currency)} />
        <Stat label="Churn" value={`%${Math.round(data.subscriptions.churnRate * 100)}`} />
        <Stat label="Dönüşüm" value={`%${Math.round(data.conversionRate * 100)}`} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="bg-surface/80 rounded-card border-text/5 space-y-3 border p-4">
          <h2 className="font-semibold">Kayıtlar</h2>
          <Bars data={data.signupsByDay} value={(row) => row.count} format={(n) => String(n)} />
        </section>
        <section className="bg-surface/80 rounded-card border-text/5 space-y-3 border p-4">
          <h2 className="font-semibold">Gelir</h2>
          <Bars
            data={data.revenueByDay}
            value={(row) => row.amount}
            format={(n) => formatPrice(n, currency)}
          />
        </section>
      </div>
      <Button variant="secondary" size="sm" onClick={() => void dashboard.refetch()}>
        Yenile
      </Button>
    </div>
  );
}

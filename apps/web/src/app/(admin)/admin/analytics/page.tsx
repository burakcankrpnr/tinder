'use client';

import { Button, Field, Input, Select } from '@dating/ui';
import { useState } from 'react';
import { AdminLoad } from '../_components';
import { useAdminAnalytics } from '@/lib/admin';
import { formatPrice } from '@/lib/billing';

function pct(value: number | null): string {
  return value === null ? '—' : `%${Math.round(value * 1000) / 10}`;
}

export default function AdminAnalyticsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState('');
  const [applied, setApplied] = useState<Record<string, string>>({});
  const analytics = useAdminAnalytics(applied);
  const data = analytics.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analitik</h1>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ from, to, country, status });
        }}
      >
        <Field label="Başlangıç">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="Bitiş">
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <Field label="Ülke">
          <Input maxLength={2} value={country} onChange={(event) => setCountry(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Hesap durumu">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tümü</option>
            <option value="ACTIVE">Aktif</option>
            <option value="RESTRICTED">Kısıtlı</option>
            <option value="BANNED">Yasaklı</option>
          </Select>
        </Field>
        <Button type="submit">Uygula</Button>
      </form>
      <AdminLoad pending={analytics.isPending} error={analytics.error}>
        {data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="DAU" value={String(data.dau)} />
              <Kpi label="WAU" value={String(data.wau)} />
              <Kpi label="MAU" value={String(data.mau)} />
              <Kpi label="Kayıt dönüşümü" value={pct(data.signupConversion)} />
              <Kpi label="Profil tamamlama" value={pct(data.profileCompletion)} />
              <Kpi label="Eşleşme oranı" value={pct(data.matchRate)} />
              <Kpi label="Mesaj oranı" value={pct(data.messageRate)} />
              <Kpi label="D1 / D7 / D30" value={`${pct(data.retention.d1)} / ${pct(data.retention.d7)} / ${pct(data.retention.d30)}`} />
              <Kpi label="Abonelik dönüşümü" value={pct(data.subscriptionConversion)} />
              <Kpi label="MRR" value={formatPrice(data.mrr, 'TRY')} />
              <Kpi label="ARPU" value={data.arpu === null ? '—' : formatPrice(data.arpu, 'TRY')} />
              <Kpi label="Churn" value={pct(data.churn)} />
              <Kpi label="LTV" value={data.ltv === null ? '—' : formatPrice(data.ltv, 'TRY')} />
              <Kpi label="Aktif kullanıcı başı gelir" value={data.revenuePerActiveUser === null ? '—' : formatPrice(data.revenuePerActiveUser, 'TRY')} />
            </div>
            <section>
              <h2 className="mb-2 font-semibold">Olaylar</h2>
              <ul className="text-sm">
                {data.events.map((event) => (
                  <li key={event.name} className="flex justify-between border-text/5 border-b py-1">
                    <span>{event.name}</span>
                    <span className="tabular-nums">{event.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </AdminLoad>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface/80 rounded-card border-text/5 border p-3">
      <p className="text-text-muted text-xs">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

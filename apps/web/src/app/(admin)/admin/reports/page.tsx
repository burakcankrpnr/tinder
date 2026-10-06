'use client';

import type { ReportReason, ReportStatus } from '@dating/types';
import { Button, Field, Select, Textarea } from '@dating/ui';
import Link from 'next/link';
import { useState } from 'react';
import { AdminLoad, FilterBar, LoadMore } from '../_components';
import { api, errorMessage } from '@/lib/api-client';
import { useAdminReports, useInvalidateAdmin } from '@/lib/admin';
import { REPORT_REASON_LABELS } from '@/lib/labels';
import { formatDate } from '@/lib/format';

const STATUSES: Record<ReportStatus, string> = {
  OPEN: 'Açık',
  REVIEWING: 'İncelemede',
  RESOLVED: 'Çözüldü',
  DISMISSED: 'Reddedildi',
};

export default function AdminReportsPage() {
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [applied, setApplied] = useState({ status: '', reason: '' });
  const reports = useAdminReports(applied);
  const invalidate = useInvalidateAdmin();
  const rows = reports.data?.pages.flatMap((page) => page.items) ?? [];
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolve = async (id: string, next: 'REVIEWING' | 'RESOLVED' | 'DISMISSED', action: 'NONE' | 'RESTRICT' | 'BAN') => {
    setBusy(id);
    setError(null);
    try {
      await api(`/admin/reports/${id}/resolve`, {
        method: 'POST',
        body: { status: next, resolution: resolution[id] || undefined, action },
      });
      await invalidate();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Raporlar</h1>
      <FilterBar>
        <Field label="Durum">
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setApplied((current) => ({ ...current, status: event.target.value }));
            }}
          >
            <option value="">Tümü</option>
            {Object.entries(STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Neden">
          <Select
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setApplied((current) => ({ ...current, reason: event.target.value }));
            }}
          >
            <option value="">Tümü</option>
            {Object.entries(REPORT_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>
      {error && <p className="text-danger text-sm">{error}</p>}
      <AdminLoad pending={reports.isPending} error={reports.error}>
        <ul className="space-y-4">
          {rows.length === 0 && <p className="text-text-muted text-sm">Rapor yok.</p>}
          {rows.map((report) => (
            <li key={report.id} className="bg-surface/80 rounded-card border-text/5 space-y-3 border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {REPORT_REASON_LABELS[report.reason as ReportReason]} · {STATUSES[report.status]}
                </p>
                <time className="text-text-muted text-xs">{formatDate(report.createdAt)}</time>
              </div>
              <p className="text-sm">
                Bildiren{' '}
                <Link className="text-primary" href={`/admin/users/${report.reporter.id}`}>
                  {report.reporter.firstName ?? report.reporter.id}
                </Link>{' '}
                →{' '}
                <Link className="text-primary" href={`/admin/users/${report.reportedUser.id}`}>
                  {report.reportedUser.firstName ?? report.reportedUser.id}
                </Link>{' '}
                ({report.reportedUser.totalReports} rapor)
              </p>
              {report.details && <p className="text-text-muted text-sm">{report.details}</p>}
              {report.message && (
                <p className="bg-surface-2 rounded-xl p-3 text-sm">{report.message.body ?? '[görsel]'}</p>
              )}
              {report.status === 'OPEN' || report.status === 'REVIEWING' ? (
                <div className="space-y-2">
                  <Field label="Karar notu">
                    <Textarea
                      value={resolution[report.id] ?? ''}
                      onChange={(event) => setResolution((current) => ({ ...current, [report.id]: event.target.value }))}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" loading={busy === report.id} onClick={() => void resolve(report.id, 'REVIEWING', 'NONE')}>
                      İncelemeye al
                    </Button>
                    <Button size="sm" loading={busy === report.id} onClick={() => void resolve(report.id, 'RESOLVED', 'NONE')}>
                      Çöz
                    </Button>
                    <Button size="sm" variant="secondary" loading={busy === report.id} onClick={() => void resolve(report.id, 'RESOLVED', 'RESTRICT')}>
                      Kısıtla
                    </Button>
                    <Button size="sm" variant="danger" loading={busy === report.id} onClick={() => void resolve(report.id, 'RESOLVED', 'BAN')}>
                      Yasakla
                    </Button>
                    <Button size="sm" variant="ghost" loading={busy === report.id} onClick={() => void resolve(report.id, 'DISMISSED', 'NONE')}>
                      Reddet
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-text-muted text-xs">{report.resolution}</p>
              )}
            </li>
          ))}
        </ul>
        <LoadMore hasNext={Boolean(reports.hasNextPage)} loading={reports.isFetchingNextPage} onClick={() => void reports.fetchNextPage()} />
      </AdminLoad>
    </div>
  );
}

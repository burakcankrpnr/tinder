'use client';

import type { UserRole, UserStatus } from '@dating/types';
import { Alert, Button, Field, Input } from '@dating/ui';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AdminLoad } from '../../_components';
import { api, errorMessage } from '@/lib/api-client';
import { useAdminUser, useInvalidateAdmin } from '@/lib/admin';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';

const STATUS: Record<Exclude<UserStatus, 'DEACTIVATED'>, string> = {
  ACTIVE: 'Aktif',
  RESTRICTED: 'Kısıtlı',
  BANNED: 'Yasaklı',
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useAuth();
  const isAdmin = state.status === 'authenticated' && state.user.role === 'ADMIN';
  const user = useAdminUser(id);
  const invalidate = useInvalidateAdmin();
  const [statusReason, setStatusReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, work: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await work();
      await invalidate();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminLoad pending={user.isPending} error={user.error}>
      {user.data && (
        <div className="space-y-8">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold">
              {user.data.firstName ?? 'Kullanıcı'} @{user.data.username ?? 'yok'}
            </h1>
            <p className="text-text-muted text-sm">{user.data.email}</p>
          </header>
          {error && <Alert tone="danger">{error}</Alert>}

          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Info label="Durum" value={user.data.status} />
            <Info label="Rol" value={user.data.role} />
            <Info label="Doğrulama" value={user.data.verificationStatus} />
            <Info label="Paket" value={user.data.plan} />
            <Info label="Yaş" value={String(user.data.age)} />
            <Info label="Şehir" value={user.data.city ?? '—'} />
            <Info label="Kayıt" value={formatDate(user.data.createdAt)} />
            <Info label="Oturum" value={String(user.data.activeSessions)} />
          </dl>

          <section className="space-y-3">
            <h2 className="font-semibold">İstatistik</h2>
            <p className="text-text-muted text-sm">
              Verilen beğeni {user.data.stats.likesGiven} · alınan {user.data.stats.likesReceived} · eşleşme{' '}
              {user.data.stats.matches} · mesaj {user.data.stats.messages} · rapor {user.data.stats.reportsMade}
            </p>
          </section>

          {user.data.photos.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold">Fotoğraflar</h2>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {user.data.photos.map((photo) => (
                  <li key={photo.id} className="bg-surface-2 relative aspect-square overflow-hidden rounded-xl">
                    {photo.urls ? (
                      <Image src={photo.urls.thumb} alt="" fill unoptimized className="object-cover" />
                    ) : (
                      <span className="text-text-muted flex h-full items-center justify-center text-xs">{photo.status}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="font-semibold">Durum değiştir</h2>
            <Field label="Gerekçe">
              <Input value={statusReason} onChange={(event) => setStatusReason(event.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS) as Array<keyof typeof STATUS>).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={status === 'BANNED' ? 'danger' : 'secondary'}
                  disabled={user.data.status === status || statusReason.trim().length < 3}
                  loading={busy === status}
                  onClick={() =>
                    void run(status, () =>
                      api(`/admin/users/${id}/status`, { method: 'PATCH', body: { status, reason: statusReason } }),
                    )
                  }
                >
                  {STATUS[status]}
                </Button>
              ))}
            </div>
          </section>

          {isAdmin && (
            <section className="space-y-3">
              <h2 className="font-semibold">Rol</h2>
              <div className="flex flex-wrap gap-2">
                {(['USER', 'MODERATOR', 'ADMIN'] as UserRole[]).map((role) => (
                  <Button
                    key={role}
                    size="sm"
                    variant="secondary"
                    disabled={user.data.role === role}
                    loading={busy === role}
                    onClick={() =>
                      void run(role, () => api(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } }))
                    }
                  >
                    {role}
                  </Button>
                ))}
              </div>
            </section>
          )}

          {user.data.recentAudit.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold">Son işlemler</h2>
              <ul className="text-text-muted space-y-1 text-xs">
                {user.data.recentAudit.map((entry) => (
                  <li key={entry.id}>
                    {formatDate(entry.createdAt)} · {entry.action}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </AdminLoad>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface/80 rounded-2xl border-text/5 border p-3">
      <dt className="text-text-muted text-xs">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

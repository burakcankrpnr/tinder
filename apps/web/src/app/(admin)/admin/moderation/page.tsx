'use client';

import { Button, Field, Input } from '@dating/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { AdminLoad, LoadMore } from '../_components';
import { api, errorMessage } from '@/lib/api-client';
import { useInvalidateAdmin, useModerationPhotos, useModerationVerifications } from '@/lib/admin';

export default function AdminModerationPage() {
  const photos = useModerationPhotos();
  const verifications = useModerationVerifications();
  const invalidate = useInvalidateAdmin();
  const photoRows = photos.data?.pages.flatMap((page) => page.items) ?? [];
  const verificationRows = verifications.data?.pages.flatMap((page) => page.items) ?? [];
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (path: string, id: string, decision: 'APPROVE' | 'REJECT') => {
    setBusy(id);
    setError(null);
    try {
      await api(path, { method: 'POST', body: { decision, reason: decision === 'REJECT' ? reason : undefined } });
      await invalidate();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Moderasyon kuyruğu</h1>
      <Field label="Red gerekçesi">
        <Input value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      {error && <p className="text-danger text-sm">{error}</p>}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Fotoğraflar</h2>
        <AdminLoad pending={photos.isPending} error={photos.error}>
          {photoRows.length === 0 ? (
            <p className="text-text-muted text-sm">Bekleyen fotoğraf yok.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {photoRows.map((photo) => (
                <li key={photo.id} className="bg-surface/80 rounded-card border-text/5 space-y-2 border p-3">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl">
                    {photo.urls ? (
                      <Image src={photo.urls.medium} alt="" fill unoptimized className="object-cover" />
                    ) : (
                      <div className="text-text-muted flex h-full items-center justify-center text-xs">Görsel yok</div>
                    )}
                  </div>
                  <Link href={`/admin/users/${photo.userId}`} className="text-primary text-sm">
                    @{photo.username ?? photo.userId}
                  </Link>
                  <p className="text-text-muted text-xs">skor {photo.moderationScore ?? '—'}</p>
                  <div className="flex gap-2">
                    <Button size="sm" loading={busy === photo.id} onClick={() => void decide(`/admin/moderation/photos/${photo.id}`, photo.id, 'APPROVE')}>
                      Onayla
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={reason.trim().length < 3}
                      loading={busy === photo.id}
                      onClick={() => void decide(`/admin/moderation/photos/${photo.id}`, photo.id, 'REJECT')}
                    >
                      Reddet
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <LoadMore hasNext={Boolean(photos.hasNextPage)} loading={photos.isFetchingNextPage} onClick={() => void photos.fetchNextPage()} />
        </AdminLoad>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Doğrulama selfileri</h2>
        <AdminLoad pending={verifications.isPending} error={verifications.error}>
          {verificationRows.length === 0 ? (
            <p className="text-text-muted text-sm">Bekleyen doğrulama yok.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {verificationRows.map((item) => (
                <li key={item.id} className="bg-surface/80 rounded-card border-text/5 space-y-2 border p-3">
                  <p className="text-sm">
                    Jest: <strong>{item.gesture}</strong> · @{item.username}
                  </p>
                  {/* selfie URL is signed/public from storage */}
                  <img src={item.selfieUrl} alt="Doğrulama selfisi" className="max-h-64 rounded-xl object-cover" />
                  <div className="flex gap-2">
                    {item.profilePhotos.map((urls) => (
                      <img key={urls.thumb} src={urls.thumb} alt="" className="size-16 rounded-lg object-cover" />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" loading={busy === item.id} onClick={() => void decide(`/admin/moderation/verifications/${item.id}`, item.id, 'APPROVE')}>
                      Onayla
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={reason.trim().length < 3}
                      loading={busy === item.id}
                      onClick={() => void decide(`/admin/moderation/verifications/${item.id}`, item.id, 'REJECT')}
                    >
                      Reddet
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <LoadMore
            hasNext={Boolean(verifications.hasNextPage)}
            loading={verifications.isFetchingNextPage}
            onClick={() => void verifications.fetchNextPage()}
          />
        </AdminLoad>
      </section>
    </div>
  );
}

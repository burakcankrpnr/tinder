'use client';

import type { PhotoDto } from '@dating/types';
import { MAX_PHOTOS } from '@dating/validation';
import { Alert, Button, Spinner, cx } from '@dating/ui';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { api, errorMessage } from '@/lib/api-client';
import { ACCEPTED_PHOTO_TYPES, uploadPhoto, validatePhotoFile } from '@/lib/photo-upload';
import { queryKeys, usePhotos } from '@/lib/queries';

interface UploadItem {
  key: string;
  name: string;
  previewUrl: string;
  progress: number;
  error: string | null;
}

const STATUS_LABELS: Partial<Record<PhotoDto['status'], string>> = {
  PROCESSING: 'İşleniyor…',
  PENDING_REVIEW: 'İncelemede',
  REJECTED: 'Reddedildi',
};

function isOrderable(photo: PhotoDto): boolean {
  return photo.status !== 'PENDING_UPLOAD' && photo.status !== 'REJECTED';
}

export function PhotoManager() {
  const queryClient = useQueryClient();
  const photos = usePhotos({ poll: true });
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = (photos.data ?? []).filter((photo) => photo.status !== 'PENDING_UPLOAD');
  const usableCount = visible.filter((photo) => photo.status !== 'REJECTED').length;
  const activeUploads = uploads.filter((item) => !item.error).length;
  const remaining = Math.max(0, MAX_PHOTOS - usableCount - activeUploads);

  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;
  useEffect(
    () => () => {
      for (const item of uploadsRef.current) URL.revokeObjectURL(item.previewUrl);
    },
    [],
  );

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.photos }),
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile }),
    ]);

  const updateUpload = (key: string, patch: Partial<UploadItem>) =>
    setUploads((items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const removeUpload = (key: string) =>
    setUploads((items) => {
      const item = items.find((candidate) => candidate.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return items.filter((candidate) => candidate.key !== key);
    });

  const addFiles = (files: File[]) => {
    setError(null);
    if (files.length > remaining) {
      setError(`En fazla ${MAX_PHOTOS} fotoğraf yükleyebilirsin. ${remaining} yer kaldı.`);
    }
    for (const file of files.slice(0, remaining)) {
      const key = crypto.randomUUID();
      const invalid = validatePhotoFile(file);
      setUploads((items) => [
        ...items,
        { key, name: file.name, previewUrl: URL.createObjectURL(file), progress: 0, error: invalid },
      ]);
      if (invalid) continue;
      uploadPhoto(file, (progress) => updateUpload(key, { progress }))
        .then(async () => {
          await refresh();
          removeUpload(key);
        })
        .catch((uploadError: unknown) => updateUpload(key, { error: errorMessage(uploadError) }));
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles([...event.dataTransfer.files]);
  };

  const remove = async (photo: PhotoDto) => {
    setBusyId(photo.id);
    setError(null);
    try {
      await api(`/photos/${photo.id}`, { method: 'DELETE' });
      await refresh();
    } catch (removeError) {
      setError(errorMessage(removeError));
    } finally {
      setBusyId(null);
    }
  };

  const move = async (photo: PhotoDto, direction: -1 | 1) => {
    const ordered = visible.filter(isOrderable);
    const index = ordered.findIndex((item) => item.id === photo.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target]!, next[index]!];

    const previous = photos.data;
    queryClient.setQueryData<PhotoDto[]>(queryKeys.photos, [
      ...next.map((item, position) => ({ ...item, position })),
      ...visible.filter((item) => !isOrderable(item)),
    ]);
    try {
      const result = await api<PhotoDto[]>('/photos/order', {
        method: 'PUT',
        body: { ids: next.map((item) => item.id) },
      });
      queryClient.setQueryData(queryKeys.photos, result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
    } catch (moveError) {
      queryClient.setQueryData(queryKeys.photos, previous);
      setError(errorMessage(moveError));
    }
  };

  if (photos.isPending) return <Spinner className="text-primary" label="Fotoğraflar yükleniyor" />;
  if (photos.isError) return <Alert tone="danger">{errorMessage(photos.error)}</Alert>;

  const orderable = visible.filter(isOrderable);

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Fotoğrafların">
        {visible.map((photo) => {
          const orderIndex = orderable.findIndex((item) => item.id === photo.id);
          return (
            <li
              key={photo.id}
              className="bg-surface-2 border-text/10 relative aspect-[3/4] overflow-hidden rounded-2xl border"
            >
              {photo.urls ? (
                <Image
                  src={photo.urls.medium}
                  alt={`Fotoğraf ${photo.position + 1}`}
                  fill
                  unoptimized
                  sizes="(min-width: 640px) 33vw, 50vw"
                  className={cx('object-cover', photo.status === 'REJECTED' && 'opacity-30')}
                />
              ) : (
                <div className="text-text-muted flex h-full items-center justify-center">
                  {photo.status === 'PROCESSING' ? <Spinner className="text-primary size-7" /> : null}
                </div>
              )}
              {orderIndex === 0 && (
                <span className="bg-accent-gradient text-on-accent absolute top-2 left-2 rounded-full px-2.5 py-1 text-xs font-semibold">
                  Ana fotoğraf
                </span>
              )}
              {STATUS_LABELS[photo.status] && (
                <span
                  className={cx(
                    'absolute top-2 right-2 rounded-full px-2.5 py-1 text-xs',
                    photo.status === 'REJECTED' ? 'bg-danger/90 text-on-accent' : 'bg-bg-bottom/80',
                  )}
                >
                  {STATUS_LABELS[photo.status]}
                </span>
              )}
              {photo.status === 'REJECTED' && photo.rejectReason && (
                <p className="text-danger absolute inset-x-2 top-12 text-center text-xs">{photo.rejectReason}</p>
              )}
              <div className="from-bg-bottom/90 absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t to-transparent p-2">
                {orderIndex >= 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2.5"
                      aria-label="Öne taşı"
                      disabled={orderIndex === 0}
                      onClick={() => void move(photo, -1)}
                    >
                      ←
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2.5"
                      aria-label="Geriye taşı"
                      disabled={orderIndex === orderable.length - 1}
                      onClick={() => void move(photo, 1)}
                    >
                      →
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="danger"
                  className="ml-auto px-3"
                  loading={busyId === photo.id}
                  onClick={() => void remove(photo)}
                >
                  Sil
                </Button>
              </div>
            </li>
          );
        })}

        {uploads.map((item) => (
          <li
            key={item.key}
            className="bg-surface-2 border-text/10 relative aspect-[3/4] overflow-hidden rounded-2xl border"
          >
            <img src={item.previewUrl} alt="" className="h-full w-full object-cover opacity-50" />
            <div className="absolute inset-x-3 bottom-3 space-y-2">
              {item.error ? (
                <>
                  <p className="text-danger text-xs">{item.error}</p>
                  <Button size="sm" variant="secondary" onClick={() => removeUpload(item.key)}>
                    Kapat
                  </Button>
                </>
              ) : (
                <div
                  role="progressbar"
                  aria-label={`${item.name} yükleniyor`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(item.progress * 100)}
                  className="bg-text/20 h-1.5 overflow-hidden rounded-full"
                >
                  <div className="bg-primary h-full transition-all" style={{ width: `${item.progress * 100}%` }} />
                </div>
              )}
            </div>
          </li>
        ))}

        {remaining > 0 && (
          <li>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cx(
                'flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center transition',
                dragging ? 'border-primary bg-primary/10' : 'border-text/15 bg-surface/40',
              )}
            >
              <span aria-hidden className="text-primary text-3xl">
                +
              </span>
              <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
                Fotoğraf seç
              </Button>
              <span className="text-text-muted text-xs">veya sürükleyip bırak</span>
            </div>
          </li>
        )}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_PHOTO_TYPES}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          addFiles([...(event.target.files ?? [])]);
          event.target.value = '';
        }}
      />

      <p className="text-text-muted text-xs">
        En fazla {MAX_PHOTOS} fotoğraf · JPEG, PNG veya WebP · en fazla 10 MB. Konum bilgisi (EXIF) yüklemeden sonra
        silinir.
      </p>
    </div>
  );
}

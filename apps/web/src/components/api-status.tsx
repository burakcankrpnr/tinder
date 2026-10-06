'use client';

import type { ApiResponse, HealthDto } from '@dating/types';
import { useEffect, useState } from 'react';
import { publicEnv } from '@/lib/env';

type Status = 'loading' | 'ok' | 'degraded' | 'offline';

const LABELS: Record<Status, string> = {
  loading: 'API kontrol ediliyor…',
  ok: 'API çalışıyor',
  degraded: 'API kısmen çalışıyor',
  offline: 'API erişilemiyor',
};

const DOT_CLASSES: Record<Status, string> = {
  loading: 'bg-text-muted animate-pulse',
  ok: 'bg-success',
  degraded: 'bg-warning',
  offline: 'bg-danger',
};

export function ApiStatus() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${publicEnv.apiUrl}/api/v1/health`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => response.json() as Promise<ApiResponse<HealthDto>>)
      .then((body) => setStatus(body.success ? body.data.status : 'degraded'))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus('offline');
      });
    return () => controller.abort();
  }, []);

  return (
    <p
      role="status"
      aria-live="polite"
      className="bg-surface/70 text-text-muted inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
    >
      <span aria-hidden className={`size-2 rounded-full ${DOT_CLASSES[status]}`} />
      {LABELS[status]}
    </p>
  );
}

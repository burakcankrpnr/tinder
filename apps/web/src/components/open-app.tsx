'use client';

import { buttonClasses } from '@dating/ui';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function OpenApp({
  schemePath,
  title,
  body,
}: {
  schemePath: 'verify-email' | 'reset-password';
  title: string;
  body: string;
}) {
  const token = useSearchParams().get('token') ?? '';
  const href = `dating://${schemePath}?token=${encodeURIComponent(token)}`;

  useEffect(() => {
    if (token) window.location.assign(href);
  }, [href, token]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="text-text-muted">{body}</p>
      {token ? (
        <a href={href} className={buttonClasses({ size: 'lg' })}>
          Uygulamada aç
        </a>
      ) : (
        <p className="text-danger">Bağlantı geçersiz.</p>
      )}
    </main>
  );
}

'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="tr">
      <body className="bg-bg-bottom text-text mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="text-xl font-semibold">Uygulama yüklenemedi</h1>
        <p className="text-text-muted text-sm">Beklenmeyen bir hata oluştu.</p>
        <button type="button" onClick={reset} className="rounded-full bg-primary px-5 py-3 font-semibold text-text">
          Tekrar dene
        </button>
      </body>
    </html>
  );
}

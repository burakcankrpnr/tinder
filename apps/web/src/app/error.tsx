'use client';

import { Alert, Button } from '@dating/ui';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center gap-4 px-6">
      <Alert tone="danger" title="Bir şeyler ters gitti">
        Sayfa yüklenemedi. Tekrar deneyebilir veya ana sayfaya dönebilirsin.
      </Alert>
      <Button onClick={reset}>Tekrar dene</Button>
    </div>
  );
}

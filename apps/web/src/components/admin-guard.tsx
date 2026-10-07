'use client';

import { Alert, Button } from '@dating/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { errorMessage } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { FullPageSpinner } from './full-page-spinner';

/** Admin paneli: USER rolünü reddeder; onboarding tamamlanmamış olsa da açılır. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const staff = state.status === 'authenticated' && (state.user.role === 'ADMIN' || state.user.role === 'MODERATOR');

  useEffect(() => {
    if (state.status === 'anonymous') router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [state.status, pathname, router]);

  if (state.status === 'loading' || state.status === 'anonymous') return <FullPageSpinner label="Yükleniyor" />;
  if (!staff) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <Alert tone="danger" title="Yetkin yok">
          Bu sayfa yalnızca moderatör ve yöneticilere açıktır.
        </Alert>
        <Button variant="secondary" onClick={() => router.replace('/')}>
          Ana sayfa
        </Button>
      </div>
    );
  }
  if (state.status === 'authenticated' && !state.user) {
    return <Alert tone="danger">{errorMessage(new Error('Oturum bulunamadı.'))}</Alert>;
  }
  return <>{children}</>;
}

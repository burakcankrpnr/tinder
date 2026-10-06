'use client';

import { Alert, Button } from '@dating/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { errorMessage } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { homePathFor, useMyProfile } from '@/lib/queries';
import { FullPageSpinner } from './full-page-spinner';

/** Private sayfalar: giriş yoksa /login, onboarding bitmemişse sıradaki adıma yönlendirir. */
export function AppGuard({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const profile = useMyProfile();

  const inOnboarding = pathname.startsWith('/onboarding');
  const redirectTo =
    state.status === 'anonymous'
      ? `/login?next=${encodeURIComponent(pathname)}`
      : profile.data && !profile.data.onboarding.completed && !inOnboarding
        ? homePathFor(profile.data)
        : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (state.status === 'authenticated' && profile.isError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <Alert tone="danger" title="Profil yüklenemedi">
          {errorMessage(profile.error)}
        </Alert>
        <Button variant="secondary" onClick={() => void profile.refetch()}>
          Tekrar dene
        </Button>
      </div>
    );
  }

  if (state.status !== 'authenticated' || !profile.data || redirectTo) return <FullPageSpinner />;
  return <>{children}</>;
}

/**
 * Login/register gibi sayfalar: oturum açıksa kullanıcıyı uygulamaya (veya güvenli `next` adresine) gönderir.
 * Başarılı girişten sonraki yönlendirme de buradan yapılır.
 */
export function GuestGuard({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const profile = useMyProfile();

  useEffect(() => {
    if (state.status === 'authenticated' && profile.data) {
      router.replace(homePathFor(profile.data, next));
    }
  }, [state.status, profile.data, next, router]);

  if (state.status === 'anonymous' || profile.isError) return <>{children}</>;
  return <FullPageSpinner />;
}

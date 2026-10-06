import { Suspense } from 'react';
import { OpenApp } from '@/components/open-app';

export default function ResetPasswordOpenPage() {
  return (
    <Suspense>
      <OpenApp
        schemePath="reset-password"
        title="Şifreni yenile"
        body="Yeni şifreyi uygulamada belirlersin. Bu sayfada form yok."
      />
    </Suspense>
  );
}

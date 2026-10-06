import { Suspense } from 'react';
import { OpenApp } from '@/components/open-app';

async function confirmEmail(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.API_URL ?? 'http://localhost:4000'}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default async function VerifyEmailOpenPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? '';
  const verified = token.length >= 32 ? await confirmEmail(token) : false;

  return (
    <Suspense>
      <OpenApp
        schemePath="verify-email"
        title={verified ? 'E-postan doğrulandı' : 'Emailini doğrula'}
        body={
          verified
            ? 'Hesabın hazır. Uygulamayı aç ve kayıt olurken yazdığın e-posta ile şifreyi gir. Maildeki düğme seni içeri almaz.'
            : 'Doğrulama uygulamada tamamlanır. Telefonunda uygulama yoksa bağlantıyı oradan aç.'
        }
      />
    </Suspense>
  );
}

'use client';

import { loginSchema } from '@dating/validation';
import { Alert, Button, Field, Input } from '@dating/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/lib/auth-context';
import { applyServerErrors } from '@/lib/form-errors';

function AdminLoginForm() {
  const { login, logout, state } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values);
      if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
        await logout();
        setFormError('Bu giriş yalnızca moderatör ve yöneticiler içindir.');
        return;
      }
      const dest = next && next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin';
      router.replace(dest);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email', 'password']));
    }
  });

  useEffect(() => {
    if (state.status === 'authenticated' && (state.user.role === 'ADMIN' || state.user.role === 'MODERATOR')) {
      router.replace('/admin');
    }
  }, [router, state]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Yönetici girişi</h1>
        <p className="text-text-muted text-sm">Bu sayfa herkese açık menüde yer almaz. Hesaplar buradan açılmaz.</p>
      </div>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="username" inputMode="email" {...register('email')} />
        </Field>
        <Field label="Şifre" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </Field>
        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          Giriş yap
        </Button>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}

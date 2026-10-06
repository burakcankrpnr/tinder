'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminGuard } from '@/components/admin-guard';
import { AdminHeader } from '@/components/admin-header';

export function AdminFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin/login') return <>{children}</>;
  return (
    <AdminGuard>
      <AdminHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </AdminGuard>
  );
}

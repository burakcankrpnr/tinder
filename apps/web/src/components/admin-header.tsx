'use client';

import { Button, cx } from '@dating/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

const MOD_NAV = [
  { href: '/admin/users', label: 'Kullanıcılar' },
  { href: '/admin/reports', label: 'Raporlar' },
  { href: '/admin/moderation', label: 'Moderasyon' },
];

const ADMIN_NAV = [
  { href: '/admin', label: 'Özet' },
  ...MOD_NAV,
  { href: '/admin/subscriptions', label: 'Abonelikler' },
  { href: '/admin/payments', label: 'Ödemeler' },
  { href: '/admin/analytics', label: 'Analitik' },
  { href: '/admin/settings', label: 'Ayarlar' },
];

export function AdminHeader() {
  const pathname = usePathname();
  const { state, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const isAdmin = state.status === 'authenticated' && state.user.role === 'ADMIN';
  const nav = isAdmin ? ADMIN_NAV : MOD_NAV;

  return (
    <header className="border-text/5 bg-bg-bottom/40 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
        <Link href={isAdmin ? '/admin' : '/admin/users'} className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="bg-accent-gradient size-7 rounded-xl" />
          Admin
        </Link>
        <nav aria-label="Yönetim" className="flex flex-1 gap-1 overflow-x-auto">
          {nav.map((item) => {
            const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition',
                  active ? 'bg-primary/20 text-text' : 'text-text-muted hover:text-text',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            loading={busy}
            onClick={() => {
              setBusy(true);
              void logout().finally(() => setBusy(false));
            }}
          >
            Çıkış
          </Button>
        </div>
      </div>
    </header>
  );
}

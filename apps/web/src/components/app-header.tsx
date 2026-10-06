'use client';

import { cx } from '@dating/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMatches, useUnreadNotifications } from '@/lib/communication';
import { useMyProfile } from '@/lib/queries';
import { BellIcon, SettingsIcon } from './icons';

const NAV = [
  { href: '/discover', label: 'Keşfet' },
  { href: '/likes', label: 'Beğeniler' },
  { href: '/matches', label: 'Eşleşmeler' },
  { href: '/profile', label: 'Profil' },
];

function Badge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span className="bg-danger text-on-accent ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-5">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

const iconLink =
  'text-text-muted hover:text-text focus-visible:outline-primary relative inline-flex size-10 items-center justify-center rounded-full transition hover:bg-text/5 focus-visible:outline-2';

export function AppHeader() {
  const pathname = usePathname();
  const profile = useMyProfile();
  const showNav = profile.data?.onboarding.completed ?? false;
  const matches = useMatches();
  const unreadNotifications = useUnreadNotifications();
  const unreadMessages = showNav
    ? (matches.data?.matches.reduce((sum, match) => sum + match.unreadCount, 0) ?? 0)
    : 0;
  const notificationCount = unreadNotifications.data ?? 0;

  return (
    <header className="border-text/5 bg-bg-bottom/40 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4 sm:gap-4">
        <Link href={showNav ? '/discover' : '#'} className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="bg-accent-gradient size-7 rounded-xl" />
          <span className="hidden sm:inline">Dating</span>
        </Link>
        {showNav && (
          <nav aria-label="Ana menü" className="flex gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition',
                    active ? 'bg-primary/20 text-text' : 'text-text-muted hover:text-text',
                  )}
                >
                  {item.label}
                  {item.href === '/matches' && <Badge count={unreadMessages} label="okunmamış mesaj" />}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-1">
          {showNav && (
            <Link
              href="/subscription"
              className={iconLink}
              aria-label="Abonelik"
              aria-current={pathname.startsWith('/subscription') ? 'page' : undefined}
            >
              <span aria-hidden className="text-warning text-lg">★</span>
            </Link>
          )}
          {showNav && (
            <Link
              href="/notifications"
              className={iconLink}
              aria-label={notificationCount > 0 ? `Bildirimler, ${notificationCount} okunmamış` : 'Bildirimler'}
              aria-current={pathname.startsWith('/notifications') ? 'page' : undefined}
            >
              <BellIcon />
              {notificationCount > 0 && (
                <span aria-hidden className="bg-danger absolute right-2 top-2 size-2.5 rounded-full" />
              )}
            </Link>
          )}
          <Link
            href="/settings"
            className={iconLink}
            aria-label="Ayarlar"
            aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
          >
            <SettingsIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}

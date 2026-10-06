import { Card } from '@dating/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <title>{`${title} | Dating Platform`}</title>
      <Link href="/" className="flex items-center justify-center gap-2 text-lg font-semibold">
        <span aria-hidden className="bg-accent-gradient size-9 rounded-2xl" />
        Dating
      </Link>
      <Card className="space-y-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-text-muted text-sm">{subtitle}</p>}
        </div>
        {children}
      </Card>
      {footer && <div className="text-text-muted text-center text-sm">{footer}</div>}
    </main>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-primary hover:text-primary-soft font-medium underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

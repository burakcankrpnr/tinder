import type { ReactNode } from 'react';

export function StepHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <header className="space-y-2">
      <title>{`${title} | Dating Platform`}</title>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-text-muted">{description}</p>}
    </header>
  );
}

import type { ReactNode } from 'react';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="legal">
      <h1>{title}</h1>
      <div className="legal-copy">{children}</div>
    </article>
  );
}

'use client';

import type { ComponentProps } from 'react';
import { cx } from './cx';
import { useFieldControl } from './field';

export const controlClasses = cx(
  'w-full rounded-2xl border border-text/10 bg-surface/80 px-4 text-text placeholder:text-text-muted/70',
  'transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
  'disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-danger/20',
);

export function Input({ className, id, ...props }: ComponentProps<'input'>) {
  const field = useFieldControl();
  return (
    <input
      id={id ?? field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cx(controlClasses, 'h-12', className)}
      {...props}
    />
  );
}

export function Textarea({ className, id, ...props }: ComponentProps<'textarea'>) {
  const field = useFieldControl();
  return (
    <textarea
      id={id ?? field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cx(controlClasses, 'min-h-28 resize-y py-3', className)}
      {...props}
    />
  );
}

export function Select({ className, id, children, ...props }: ComponentProps<'select'>) {
  const field = useFieldControl();
  return (
    <select
      id={id ?? field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cx(controlClasses, 'h-12 appearance-none', className)}
      {...props}
    >
      {children}
    </select>
  );
}

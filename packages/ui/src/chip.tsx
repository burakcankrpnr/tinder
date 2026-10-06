import type { ComponentProps, ReactNode } from 'react';
import { cx } from './cx';

export type ChipProps = Omit<ComponentProps<'button'>, 'type'> & { selected?: boolean };

export function Chip({ selected = false, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-40',
        selected
          ? 'border-primary bg-primary/20 text-text'
          : 'border-text/10 bg-surface/60 text-text-muted hover:text-text',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Tag({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'bg-surface-2 text-text-muted inline-flex items-center rounded-full px-3 py-1 text-xs',
        className,
      )}
    >
      {children}
    </span>
  );
}

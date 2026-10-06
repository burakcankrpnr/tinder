import type { ComponentProps } from 'react';
import { cx } from './cx';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cx(
        'rounded-card bg-surface/85 border-text/5 border p-6 shadow-2xl shadow-bg-bottom/40 backdrop-blur',
        className,
      )}
      {...props}
    />
  );
}

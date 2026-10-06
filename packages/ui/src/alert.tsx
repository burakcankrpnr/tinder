import type { ReactNode } from 'react';
import { cx } from './cx';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, string> = {
  info: 'border-primary/30 bg-primary/10 text-primary-soft',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('rounded-2xl border px-4 py-3 text-sm', TONES[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cx(Boolean(title) && 'mt-1', 'opacity-90')}>{children}</div>}
    </div>
  );
}

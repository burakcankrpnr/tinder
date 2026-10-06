import type { ComponentProps } from 'react';
import { cx } from './cx';
import { Spinner } from './spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-gradient text-on-accent shadow-lg shadow-primary-strong/25 hover:brightness-110',
  secondary: 'bg-surface-2 text-text hover:bg-surface-2/80 border border-text/10',
  ghost: 'bg-transparent text-text-muted hover:text-text hover:bg-text/5',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-6 text-base',
};

export type ButtonProps = ComponentProps<'button'> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: Pick<ButtonProps, 'variant' | 'size' | 'fullWidth' | 'className'> = {}): string {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  );
}

export function Button({
  variant,
  size,
  loading = false,
  fullWidth,
  className,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

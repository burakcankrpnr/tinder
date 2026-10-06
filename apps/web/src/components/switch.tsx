'use client';

import { cx } from '@dating/ui';
import { useId } from 'react';

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span>
        <span id={`${id}-label`} className="block text-sm font-medium">
          {label}
        </span>
        {hint && (
          <span id={`${id}-hint`} className="text-text-muted block text-xs">
            {hint}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'focus-visible:outline-primary relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
          checked ? 'bg-primary-strong' : 'bg-surface-2 border-text/10 border',
        )}
      >
        <span
          aria-hidden
          className={cx(
            'bg-text absolute top-1 size-5 rounded-full shadow transition-all',
            checked ? 'left-6' : 'left-1',
          )}
        />
      </button>
    </div>
  );
}

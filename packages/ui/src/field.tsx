'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { cx } from './cx';

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Field içindeki kontroller id, aria-describedby ve aria-invalid'i otomatik alır. */
export function useFieldControl(): FieldContextValue | null {
  return useContext(FieldContext);
}

export interface FieldProps {
  label: ReactNode;
  error?: string | undefined;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, error, hint, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = cx(hint ? hintId : null, error ? errorId : null) || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cx('flex flex-col gap-1.5', className)}>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {optional && <span className="text-text-muted ml-1 font-normal">(isteğe bağlı)</span>}
        </label>
        {children}
        {hint && !error && (
          <p id={hintId} className="text-text-muted text-xs">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-danger text-xs">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

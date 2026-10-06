'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from './cx';

/** Native <dialog>: focus trap, Escape ile kapanma ve arka planın inert olması tarayıcıdan gelir. */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  hideTitle = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cx(
        'bg-surface text-text m-auto w-[calc(100%-2rem)] max-w-lg rounded-card border border-text/10 p-0 shadow-2xl',
        'backdrop:bg-scrim/70 backdrop:backdrop-blur-sm',
        className,
      )}
    >
      <div className="max-h-[85dvh] overflow-y-auto p-6">
        <h2 id={titleId} className={cx('mb-4 text-xl font-semibold', hideTitle && 'sr-only')}>
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

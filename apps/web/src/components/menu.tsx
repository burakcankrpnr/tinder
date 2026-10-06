'use client';

import { cx } from '@dating/ui';
import { type KeyboardEvent, useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
}

/** Basit erişilebilir menü: aria-expanded, Escape/dış tıklama ile kapanma, ok tuşlarıyla gezinme. */
export function Menu({
  label,
  items,
  children,
  align = 'right',
  buttonClassName,
}: {
  label: string;
  items: MenuItem[];
  children: ReactNode;
  align?: 'left' | 'right';
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const index = entries.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      entries[(index + 1) % entries.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      entries[(index - 1 + entries.length) % entries.length]?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={open ? onMenuKey : undefined}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          'text-text-muted hover:text-text focus-visible:outline-primary inline-flex size-10 items-center justify-center rounded-full transition hover:bg-text/5 focus-visible:outline-2',
          buttonClassName,
        )}
      >
        {children}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={cx(
            'bg-surface-2 border-text/10 absolute z-30 mt-1 min-w-44 overflow-hidden rounded-2xl border py-1 shadow-xl',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cx(
                'focus-visible:bg-text/10 hover:bg-text/5 block w-full px-4 py-2.5 text-left text-sm outline-none',
                item.tone === 'danger' ? 'text-danger' : 'text-text',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

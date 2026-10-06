'use client';

import { useEffect, useRef } from 'react';
import { LANGUAGES, type LangAnchor } from './nav';
import { GlobeIcon } from './icons';
import { useLandingUi } from './landing-ui';

export function LanguagePicker({ anchor, variant }: { anchor: LangAnchor; variant: 'header' | 'footer' }) {
  const { lang, headerLangLabel, footerLangLabel, setLang, langAnchor, toggleLang, closeLang } = useLandingUi();
  const rootRef = useRef<HTMLDivElement>(null);
  const open = langAnchor === anchor;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeLang();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLang();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, closeLang]);

  const label = variant === 'header' ? headerLangLabel : footerLangLabel;

  return (
    <div className="lang" ref={rootRef}>
      <button
        className={variant === 'header' ? 'icon-btn' : 'btn btn-ghost'}
        type="button"
        aria-label="Dil seç"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => toggleLang(anchor)}
      >
        {variant === 'header' ? <GlobeIcon /> : null}
        <span>{label}</span>
      </button>
      <div className={open ? 'lang-menu is-open' : 'lang-menu'} role="menu">
        {LANGUAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitemradio"
            aria-checked={lang === item.id}
            aria-current={lang === item.id ? 'true' : undefined}
            onClick={() => setLang(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

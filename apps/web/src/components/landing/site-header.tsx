'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FlameIcon } from './icons';
import { LanguagePicker } from './language-picker';
import { OpenAuthButton, useLandingUi } from './landing-ui';
import { PRIMARY_NAV } from './nav';

export function SiteHeader() {
  const { menuOpen, setMenuOpen, closeMenu } = useLandingUi();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > lastY && y > 120);
      if (y < 40) setHidden(false);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const headerClass = hidden && !menuOpen ? 'header is-hidden' : 'header';

  return (
    <>
      <header className={headerClass}>
        <Link className="logo" href="/#top" aria-label="Tinder Ana Sayfa">
          <FlameIcon />
          <span>tinder</span>
        </Link>
        <ul className="nav" role="menubar">
          {PRIMARY_NAV.map((item) => (
            <li key={item.href} role="none">
              <Link href={item.href} role="menuitem">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="header-actions">
          <LanguagePicker anchor="header" variant="header" />
          <OpenAuthButton mode="login" className="btn btn-primary">
            Oturum aç
          </OpenAuthButton>
          <button
            className="menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span />
          </button>
        </div>
      </header>
      <nav className={menuOpen ? 'mobile-panel is-open' : 'mobile-panel'} aria-label="Mobil menü">
        {PRIMARY_NAV.map((item) => (
          <Link key={item.href} href={item.href} onClick={closeMenu}>
            {item.label}
          </Link>
        ))}
        <OpenAuthButton mode="login">Oturum aç</OpenAuthButton>
        <OpenAuthButton mode="signup">Hesap Oluştur</OpenAuthButton>
      </nav>
    </>
  );
}

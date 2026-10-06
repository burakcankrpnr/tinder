'use client';

import { Fraunces, Manrope } from 'next/font/google';
import type { ReactNode } from 'react';
import { AuthModals } from './auth-modals';
import { LandingUiProvider } from './landing-ui';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import './landing.css';

const sans = Manrope({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-landing-sans',
  display: 'swap',
});

const serif = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-landing-serif',
  display: 'swap',
});

export function LandingFrame({ children }: { children: ReactNode }) {
  return (
    <LandingUiProvider>
      <div className={`landing ${sans.variable} ${serif.variable}`}>
        <a className="skip" href="#main-content">
          Ana içeriğe geç
        </a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
        <AuthModals />
      </div>
    </LandingUiProvider>
  );
}

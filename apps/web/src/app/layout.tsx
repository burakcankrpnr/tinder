import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { colors } from '@dating/ui/tokens';
import { publicEnv } from '@/lib/env';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl),
  title: {
    default: 'Dating Platform',
    template: '%s | Dating Platform',
  },
  description: 'Yeni insanlarla güvenli ve modern bir şekilde tanış.',
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'Dating Platform',
    title: 'Dating Platform',
    description: 'Yeni insanlarla güvenli ve modern bir şekilde tanış.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dating Platform',
    description: 'Yeni insanlarla güvenli ve modern bir şekilde tanış.',
  },
};

export const viewport: Viewport = {
  themeColor: colors.bgBottom,
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-app-gradient text-text min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

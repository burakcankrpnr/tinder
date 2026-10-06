import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';

export const metadata: Metadata = {
  title: { absolute: 'Tinder | Yeni insanlarla tanış' },
  description:
    'Her şey bir kaydırmayla başlar. Çifte Randevu, Astroloji Modu ve Müzik Modu ile yeni insanlarla tanış.',
};

export default function HomePage() {
  return <LandingPage />;
}

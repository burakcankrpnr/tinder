import type { ReactNode } from 'react';
import { LandingFrame } from '@/components/landing/landing-frame';

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <LandingFrame>
      <div className="subpage">
        <div className="wrap">{children}</div>
      </div>
    </LandingFrame>
  );
}

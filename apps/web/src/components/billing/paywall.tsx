'use client';

import { Modal, buttonClasses } from '@dating/ui';
import Link from 'next/link';
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { PlanComparison } from './plan-comparison';

interface PaywallState {
  title: string;
  message: string;
}

interface PaywallContextValue {
  open: (message: string, title?: string) => void;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

/** Limit dolduğunda veya kilitli özellikte açılan paywall (spec Bölüm 38). */
export function PaywallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PaywallState | null>(null);
  const open = useCallback((message: string, title = 'Premium’a geç') => setState({ title, message }), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <Modal open={state !== null} onClose={() => setState(null)} title={state?.title ?? 'Premium’a geç'} className="max-w-4xl">
        {state && (
          <div className="space-y-5">
            <p className="text-text-muted">{state.message}</p>
            <PlanComparison mode="app" />
            <div className="flex justify-center">
              <Link href="/subscription" className={buttonClasses({ variant: 'ghost', size: 'sm' })} onClick={() => setState(null)}>
                Abonelik ve paket detayları
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </PaywallContext.Provider>
  );
}

export function usePaywall(): PaywallContextValue {
  const context = useContext(PaywallContext);
  if (!context) throw new Error('usePaywall must be used within PaywallProvider');
  return context;
}

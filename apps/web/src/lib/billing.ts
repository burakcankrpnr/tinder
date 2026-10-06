'use client';

import type {
  BillingInterval,
  BoostDto,
  CatalogDto,
  CheckoutDto,
  EntitlementsDto,
  LikesReceivedDto,
  MockCheckoutDto,
  PaymentDto,
  PremiumSettingsDto,
  RewindResultDto,
} from '@dating/types';
import type { CheckoutInput, MockSimulationEvent, PremiumSettingsInput } from '@dating/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { ApiError, api } from './api-client';
import { useAuth } from './auth-context';

export const billingKeys = {
  catalog: ['billing', 'catalog'] as const,
  entitlements: ['billing', 'entitlements'] as const,
  payments: ['billing', 'payments'] as const,
  likes: ['likes'] as const,
  premiumSettings: ['profile', 'premium-settings'] as const,
  mockCheckout: (id: string) => ['billing', 'mock-checkout', id] as const,
};

/** Paywall açtıran hata kodları. */
export function isPaywallError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.code === 'LIMIT_REACHED' || error.code === 'FEATURE_LOCKED');
}

export function formatPrice(minor: number, currency: string): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100);
}

export function monthlyEquivalent(yearlyPrice: number): number {
  return Math.round(yearlyPrice / 12);
}

export const INTERVAL_LABELS: Record<BillingInterval, string> = { MONTHLY: 'Aylık', YEARLY: 'Yıllık' };

export function useCatalog() {
  return useQuery({
    queryKey: billingKeys.catalog,
    queryFn: () => api<CatalogDto>('/billing/plans'),
    staleTime: 5 * 60_000,
  });
}

export function useEntitlements() {
  const { state } = useAuth();
  return useQuery({
    queryKey: billingKeys.entitlements,
    queryFn: () => api<EntitlementsDto>('/billing/entitlements'),
    enabled: state.status === 'authenticated',
    staleTime: 30_000,
  });
}

export function usePayments() {
  return useQuery({ queryKey: billingKeys.payments, queryFn: () => api<PaymentDto[]>('/payments') });
}

function checkoutTarget(input: CheckoutInput): string {
  return input.kind === 'SUBSCRIPTION' ? `${input.planSlug}:${input.interval}` : `product:${input.productSlug}`;
}

/**
 * Checkout başlatır ve provider sayfasına yönlendirir. Ağ hatasında aynı Idempotency-Key ile
 * tekrar denenir; böylece çift tıklama veya yeniden deneme ikinci bir ödeme oturumu açmaz.
 */
export function useStartCheckout() {
  const keys = useRef(new Map<string, string>());
  return useMutation({
    mutationFn: async (input: CheckoutInput) => {
      const target = checkoutTarget(input);
      const key = keys.current.get(target) ?? crypto.randomUUID();
      keys.current.set(target, key);
      try {
        const checkout = await api<CheckoutDto>('/payments/checkout', {
          method: 'POST',
          body: input,
          headers: { 'Idempotency-Key': key },
        });
        keys.current.delete(target);
        return checkout;
      } catch (error) {
        if (!(error instanceof ApiError && error.code === 'NETWORK_ERROR')) keys.current.delete(target);
        throw error;
      }
    },
    onSuccess: (checkout) => window.location.assign(checkout.url),
  });
}

function useEntitlementsMutation<TInput>(mutationFn: (input: TInput) => Promise<EntitlementsDto>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.setQueryData(billingKeys.entitlements, data);
      void queryClient.invalidateQueries({ queryKey: billingKeys.payments });
    },
  });
}

export function useCancelSubscription() {
  return useEntitlementsMutation(() => api<EntitlementsDto>('/billing/subscription/cancel', { method: 'POST' }));
}

export function useSimulateSubscription() {
  return useEntitlementsMutation((event: MockSimulationEvent) =>
    api<EntitlementsDto>('/payments/mock/subscription/simulate', { method: 'POST', body: { event } }),
  );
}

export function useMockCheckout(checkoutId: string) {
  return useQuery({
    queryKey: billingKeys.mockCheckout(checkoutId),
    queryFn: () => api<MockCheckoutDto>(`/payments/mock/checkouts/${encodeURIComponent(checkoutId)}`),
    retry: false,
  });
}

export function useCompleteMockCheckout(checkoutId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (outcome: 'success' | 'fail' | 'cancel') =>
      api<MockCheckoutDto>(`/payments/mock/checkouts/${encodeURIComponent(checkoutId)}/complete`, {
        method: 'POST',
        body: { outcome },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(billingKeys.mockCheckout(checkoutId), data);
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: billingKeys.likes });
    },
  });
}

export function useLikesReceived() {
  return useQuery({ queryKey: billingKeys.likes, queryFn: () => api<LikesReceivedDto>('/likes') });
}

export function useActivateBoost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<BoostDto>('/boosts', { method: 'POST' }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: billingKeys.entitlements }),
  });
}

export function useRewind() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<RewindResultDto>('/swipes/rewind', { method: 'POST' }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: billingKeys.entitlements }),
  });
}

export function usePremiumSettings() {
  return useQuery({
    queryKey: billingKeys.premiumSettings,
    queryFn: () => api<PremiumSettingsDto>('/profile/me/premium-settings'),
  });
}

export function useUpdatePremiumSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PremiumSettingsInput) =>
      api<PremiumSettingsDto>('/profile/me/premium-settings', { method: 'PUT', body: input }),
    onSuccess: (data) => queryClient.setQueryData(billingKeys.premiumSettings, data),
  });
}

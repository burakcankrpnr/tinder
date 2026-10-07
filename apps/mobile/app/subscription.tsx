import type { CatalogDto, CheckoutDto, EntitlementsDto } from '@dating/types';
import { api, errorMessage } from '@/api';
import { PrimaryButton, Screen, Subtitle, Title, showAlert } from '@/ui';
import { useTheme } from '@/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { Text, View } from 'react-native';

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount / 100);
}

export default function SubscriptionScreen() {
  const { colors, ui } = useTheme();
  const queryClient = useQueryClient();
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<CatalogDto>('/billing/plans') });
  const entitlements = useQuery({
    queryKey: ['entitlements'],
    queryFn: () => api<EntitlementsDto>('/billing/entitlements'),
  });
  const [busy, setBusy] = useState<string | null>(null);

  async function subscribe(planSlug: string) {
    setBusy(planSlug);
    try {
      const checkout = await api<CheckoutDto>('/payments/checkout', {
        method: 'POST',
        headers: { 'Idempotency-Key': Crypto.randomUUID() },
        body: { kind: 'SUBSCRIPTION', planSlug, interval: 'MONTHLY' },
      });
      await api(`/payments/mock/checkouts/${checkout.checkoutId}/complete`, {
        method: 'POST',
        body: { outcome: 'success' },
      });
      await queryClient.invalidateQueries({ queryKey: ['entitlements'] });
    } catch (caught) {
      showAlert(errorMessage(caught), 'Abonelik başlamadı');
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy('cancel');
    try {
      await api('/billing/subscription/cancel', { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['entitlements'] });
    } catch (caught) {
      showAlert(errorMessage(caught), 'İptal edilemedi');
    } finally {
      setBusy(null);
    }
  }

  const current = entitlements.data?.plan.slug;

  return (
    <Screen>
      <Title>Abonelik</Title>
      <Subtitle>
        Şu an {entitlements.data?.plan.name ?? '…'} paketindesin. Ödeme bu sürümde deneme kasasıdır; mağaza içi satın alma yoktur.
      </Subtitle>
      {plans.data?.plans.map((plan) => (
        <View key={plan.slug} style={[ui.card, { padding: 16, gap: 8 }]}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{plan.name}</Text>
          <Text style={ui.subtitle}>{formatPrice(plan.monthlyPrice, plan.currency)} / ay</Text>
          {plan.slug === current ? (
            <Text style={{ color: colors.success }}>Aktif</Text>
          ) : plan.monthlyPrice === 0 ? null : (
            <PrimaryButton label="Aylık başlat" loading={busy === plan.slug} onPress={() => void subscribe(plan.slug)} />
          )}
        </View>
      ))}
      {entitlements.data?.subscription ? <PrimaryButton label="Dönem sonunda iptal et" loading={busy === 'cancel'} onPress={() => void cancel()} /> : null}
    </Screen>
  );
}

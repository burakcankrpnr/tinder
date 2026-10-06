import type { OnboardingStep } from '@dating/types';
import { ApiError, api, errorMessage } from '@/api';
import { ErrorText, PageHeading, PrimaryButton, Screen, StepBack, flagMissing, showAlert } from '@/ui';
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

export default function OnboardingLocation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        flagMissing(setError, 'Konum izni olmadan keşif açılamaz.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      await api('/profile/me/location', {
        method: 'PUT',
        body: { latitude: position.coords.latitude, longitude: position.coords.longitude },
      });
      await api('/profile/me/complete-onboarding', { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      router.replace('/discover');
    } catch (caught) {
      const step = caught instanceof ApiError ? caught.details?.find((item) => item.path === 'onboarding')?.message : undefined;
      if (step === 'profile' || step === 'photos' || step === 'preferences' || step === 'location') {
        const message =
          step === 'photos'
            ? 'Devam etmek için en az bir profil fotoğrafı ekleyin.'
            : step === 'profile'
              ? 'Devam etmek için profil bilgilerini doldurun.'
              : step === 'preferences'
                ? 'Devam etmek için keşif tercihlerini doldurun.'
                : 'Devam etmek için konum izni gerekir.';
        flagMissing(setError, message);
        router.replace(`/onboarding/${step as OnboardingStep}`);
        return;
      }
      const message = errorMessage(caught);
      setError(message);
      showAlert(message, 'Devam edilemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header>
      <Stack.Screen options={{ headerLeft: () => <StepBack href="/onboarding/preferences" /> }} />
      <PageHeading
        icon="location"
        title="Konum izni"
        subtitle="Yakınınızdaki kişileri gösterebilmek için konum izni gerekir. Tam adresiniz paylaşılmaz; yalnızca yaklaşık mesafe kullanılır."
      />
      <ErrorText>{error}</ErrorText>
      <PrimaryButton label="Konum iznini ver ve tamamla" onPress={() => void onSubmit()} loading={busy} />
    </Screen>
  );
}

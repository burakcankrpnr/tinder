import type { Gender } from '@dating/types';
import { preferencesSchema } from '@dating/validation';
import { api, errorMessage } from '@/api';
import { SelectField } from '@/select-field';
import { ErrorText, Field, PageHeading, PrimaryButton, Screen, StepBack, flagMissing, showAlert } from '@/ui';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

function emptyPreferenceMessage(
  interestedIn: readonly Gender[],
  ageMin: string,
  ageMax: string,
  distance: string,
): string | null {
  if (interestedIn.length === 0) return 'Devam etmek için en az bir seçenek işaretleyin.';
  if (!ageMin.trim()) return 'Minimum yaş boş bırakılamaz.';
  if (!ageMax.trim()) return 'Maksimum yaş boş bırakılamaz.';
  if (!distance.trim()) return 'Mesafe boş bırakılamaz.';
  return null;
}

const OPTIONS = [
  { value: 'WOMAN', label: 'Kadınlar', icon: 'female' as const },
  { value: 'MAN', label: 'Erkekler', icon: 'male' as const },
  { value: 'NON_BINARY', label: 'Non-binary', icon: 'male-female' as const },
];

export default function OnboardingPreferences() {
  const router = useRouter();
  const [interestedIn, setInterestedIn] = useState<Gender[]>(['WOMAN', 'MAN']);
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('35');
  const [distance, setDistance] = useState('50');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    const parsed = preferencesSchema.safeParse({
      interestedIn,
      ageMin,
      ageMax,
      maxDistanceKm: distance,
    });
    if (!parsed.success) {
      flagMissing(
        setError,
        emptyPreferenceMessage(interestedIn, ageMin, ageMax, distance) ??
          parsed.error.issues[0]?.message ??
          'Tercihleri kontrol et.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/profile/me/preferences', { method: 'PUT', body: parsed.data });
      router.replace('/onboarding/location');
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      showAlert(message, 'Devam edilemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header>
      <Stack.Screen options={{ headerLeft: () => <StepBack href="/onboarding/photos" /> }} />
      <PageHeading
        icon="options"
        title="Keşif tercihleri"
        subtitle="Keşfette görmek istediğiniz kişileri, yaş aralığını ve mesafeyi belirleyin. Bu tercihleri daha sonra değiştirebilirsiniz."
      />
      <ErrorText>{error}</ErrorText>
      <SelectField
        label="İlgi"
        icon="heart"
        placeholder="Kimleri görmek istediğini seç"
        multiple
        options={OPTIONS}
        values={interestedIn}
        onChangeMany={(next) => setInterestedIn(next as Gender[])}
      />
      <Field label="Minimum yaş" icon="remove-circle" keyboardType="number-pad" value={ageMin} onChangeText={setAgeMin} />
      <Field label="Maksimum yaş" icon="add-circle" keyboardType="number-pad" value={ageMax} onChangeText={setAgeMax} />
      <Field label="Mesafe (km)" icon="navigate" keyboardType="number-pad" value={distance} onChangeText={setDistance} />
      <PrimaryButton label="Devam et" onPress={() => void onSubmit()} loading={busy} />
    </Screen>
  );
}

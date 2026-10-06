import type { Gender, InterestDto, MyProfileDto } from '@dating/types';
import { Ionicons } from '@expo/vector-icons';
import { MAX_BIO_LENGTH, MAX_INTERESTS, profileBasicsSchema } from '@dating/validation';
import { api, errorMessage } from '@/api';
import { captureLocation } from '@/place';
import { SelectField } from '@/select-field';
import { useTheme } from '@/theme';
import { ErrorText, Field, PageHeading, PrimaryButton, Screen, flagMissing, showAlert } from '@/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

const GENDER_OPTIONS = [
  { value: 'WOMAN', label: 'Kadın', icon: 'female' },
  { value: 'MAN', label: 'Erkek', icon: 'male' },
  { value: 'NON_BINARY', label: 'Non-binary', icon: 'male-female' },
] as const satisfies ReadonlyArray<{ value: Gender; label: string; icon: keyof typeof Ionicons.glyphMap }>;

const INTEREST_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  fitness: 'barbell',
  yoga: 'body',
  running: 'walk',
  hiking: 'map',
  cycling: 'bicycle',
  swimming: 'water',
  football: 'football',
  basketball: 'basketball',
  tennis: 'tennisball',
  climbing: 'trending-up',
  music: 'musical-notes',
  concerts: 'mic',
  cinema: 'film',
  theatre: 'ticket',
  photography: 'camera',
  painting: 'brush',
  reading: 'book',
  writing: 'pencil',
  museums: 'business',
  dance: 'musical-note',
  cooking: 'restaurant',
  coffee: 'cafe',
  wine: 'wine',
  'street-food': 'fast-food',
  vegan: 'nutrition',
  baking: 'pizza',
  travel: 'airplane',
  camping: 'bonfire',
  pets: 'paw',
  gardening: 'flower',
  meditation: 'leaf',
  volunteering: 'hand-left',
  fashion: 'shirt',
  gaming: 'game-controller',
  'board-games': 'grid',
  technology: 'hardware-chip',
  science: 'flask',
  podcasts: 'headset',
  anime: 'tv',
};

const INTEREST_FALLBACK: Array<keyof typeof Ionicons.glyphMap> = [
  'sparkles',
  'star',
  'heart',
  'diamond',
  'flash',
  'planet',
  'rose',
  'color-wand',
];

function missingProfileMessage(input: {
  firstName: string;
  username: string;
  gender: Gender | null;
  bio: string;
  interests: number;
}): string | null {
  if (!input.firstName.trim()) return 'İsim boş bırakılamaz.';
  if (!input.username.trim()) return 'Kullanıcı adı boş bırakılamaz.';
  if (!input.gender) return 'Cinsiyet seçin.';
  if (!input.bio.trim()) return 'Biyografi boş bırakılamaz.';
  if (input.interests === 0) return 'En az bir ilgi alanı seçin.';
  return null;
}

function interestIcon(interest: InterestDto): keyof typeof Ionicons.glyphMap {
  return INTEREST_ICONS[interest.slug] ?? INTEREST_FALLBACK[interest.id % INTEREST_FALLBACK.length] ?? 'sparkles';
}

function profilePercent(input: { name: boolean; username: boolean; gender: boolean; bio: number; interests: number }): number {
  let score = 0;
  if (input.name) score += 20;
  if (input.username) score += 15;
  if (input.gender) score += 20;
  if (input.bio >= 20) score += 25;
  else if (input.bio > 0) score += 10;
  score += Math.min(input.interests, 5) * 4;
  return Math.min(score, 100);
}

export default function OnboardingProfile() {
  const { ui } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['profile', 'me'], queryFn: () => api<MyProfileDto>('/profile/me') });
  const interests = useQuery({ queryKey: ['interests'], queryFn: () => api<InterestDto[]>('/interests') });
  const [firstName, setFirstName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [bio, setBio] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me.data?.profile) return;
    setFirstName(me.data.profile.firstName);
    setUsername(me.data.profile.username);
    setGender(me.data.profile.gender);
    setBio(me.data.profile.bio ?? '');
    setSelected(me.data.interests.map((item) => item.id));
  }, [me.data]);

  const percent = profilePercent({
    name: firstName.trim().length > 0,
    username: username.trim().length > 0,
    gender: gender !== null,
    bio: bio.trim().length,
    interests: selected.length,
  });

  async function onSubmit() {
    const missing = missingProfileMessage({
      firstName,
      username,
      gender,
      bio,
      interests: selected.length,
    });
    const parsed = profileBasicsSchema.safeParse({
      firstName,
      username,
      gender: gender ?? undefined,
      bio,
      languages: ['tr'],
    });
    if (missing) {
      flagMissing(setError, missing);
      return;
    }
    if (!parsed.success) {
      flagMissing(setError, parsed.error.issues[0]?.message ?? 'Formu kontrol et.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const place = await captureLocation(true);
      if (!place) {
        flagMissing(setError, 'Yakınınızdaki kişileri gösterebilmek için konum izni gerekir.');
        return;
      }
      await api('/profile/me', {
        method: 'PUT',
        body: { ...parsed.data, city: place.city, country: place.country },
      });
      await api('/profile/me/interests', { method: 'PUT', body: { interestIds: selected } });
      await api('/profile/me/location', {
        method: 'PUT',
        body: {
          latitude: place.latitude,
          longitude: place.longitude,
          city: place.city,
          country: place.country,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      router.push('/onboarding/photos');
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
      <PageHeading
        icon="person"
        title="Kendini tanıt"
        subtitle="Adınız ve kısaca kendiniz. Konumunuz otomatik alınır; diğer kişiler sizi kilometre olarak görür. Ülke veya şehir seçmezsiniz."
      />
      <ErrorText>{error}</ErrorText>
      <View style={{ gap: 8 }}>
        <Text style={[ui.subtitle, ui.centered]}>Profiliniz %{percent} dolu</Text>
        <View style={ui.meter}>
          <View style={[ui.meterFill, { width: `${percent}%` }]} />
        </View>
        <Text style={[ui.hint, ui.centered]}>
          Ne kadar çok doldurursanız, o kadar çok kişinin karşısına çıkarsınız.
        </Text>
      </View>
      <Field label="İsim" icon="id-card" hint="Profilinizde görünecek ad." value={firstName} onChangeText={setFirstName} />
      <Field
        label="Kullanıcı adı"
        icon="at"
        autoCapitalize="none"
        hint="3 ile 20 karakter. Harf, rakam, nokta ve alt çizgi kullanabilirsiniz."
        value={username}
        onChangeText={setUsername}
      />
      <SelectField
        label="Cinsiyet"
        icon="male-female"
        placeholder="Cinsiyet seçin"
        options={GENDER_OPTIONS}
        value={gender}
        onChange={(next) => setGender(next as Gender)}
      />
      <Field
        label="Biyografi"
        icon="create"
        hint={`${bio.length}/${MAX_BIO_LENGTH}. En az birkaç cümle yazarsanız daha çok kişiye görünürsünüz.`}
        value={bio}
        onChangeText={setBio}
        maxLength={MAX_BIO_LENGTH}
        multiline
      />
      <SelectField
        label="İlgi alanları"
        icon="heart"
        placeholder={`En fazla ${MAX_INTERESTS} alan seçin`}
        multiple
        options={(interests.data ?? []).map((item) => ({
          value: String(item.id),
          label: item.name,
          icon: interestIcon(item),
        }))}
        values={selected.map(String)}
        onChangeMany={(next) => setSelected(next.slice(0, MAX_INTERESTS).map(Number))}
      />
      <PrimaryButton label="Devam et" onPress={() => void onSubmit()} loading={busy} />
    </Screen>
  );
}

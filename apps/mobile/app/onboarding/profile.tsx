import type {
  CommunicationStyle,
  EducationLevel,
  Gender,
  InterestDto,
  KidsPreference,
  LifestyleFrequency,
  LoveStyle,
  MyProfileDto,
  PetStatus,
  RelationshipIntention,
  SexualOrientation,
} from '@dating/types';
import { Ionicons } from '@expo/vector-icons';
import {
  COMMUNICATION_LABELS,
  DRINK_SMOKE_LABELS,
  EDUCATION_LEVEL_LABELS,
  EXERCISE_LABELS,
  INTENTION_LABELS,
  KIDS_LABELS,
  LANGUAGE_OPTIONS,
  LOVE_LABELS,
  MAX_BIO_LENGTH,
  MAX_INTERESTS,
  MAX_LANGUAGES,
  PET_LABELS,
  SEXUAL_ORIENTATION_LABELS,
  SOCIAL_LABELS,
  UNIVERSITIES,
  ZODIAC_LABELS,
  profileBasicsSchema,
} from '@dating/validation';
import { api, errorMessage } from '@/api';
import { captureLocation } from '@/place';
import { SelectField, type SelectOption } from '@/select-field';
import { useTheme } from '@/theme';
import { Field, PageHeading, PrimaryButton, ProfileMeter, Screen, flagMissing, showAlert } from '@/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

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

const HEIGHTS: SelectOption[] = Array.from({ length: 81 }, (_, index) => {
  const cm = 140 + index;
  return { value: String(cm), label: `${cm} cm` };
});

const UNIVERSITY_OPTIONS: SelectOption[] = [
  ...UNIVERSITIES.map((name) => ({ value: name, label: name })),
  { value: '__other__', label: 'Listede yok' },
];

function choices<T extends string>(labels: Record<T, string>): SelectOption[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

function BlockTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 }}>{children}</Text>;
}

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
  const router = useRouter();
  const fromProfile = useLocalSearchParams<{ from?: string }>().from === 'profile';
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['profile', 'me'], queryFn: () => api<MyProfileDto>('/profile/me') });
  const interests = useQuery({ queryKey: ['interests'], queryFn: () => api<InterestDto[]>('/interests') });
  const [firstName, setFirstName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [bio, setBio] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [occupation, setOccupation] = useState('');
  const [educationLevel, setEducationLevel] = useState<EducationLevel | null>(null);
  const [university, setUniversity] = useState('');
  const [universityCustom, setUniversityCustom] = useState('');
  const [sexualOrientation, setSexualOrientation] = useState<SexualOrientation | null>(null);
  const [kids, setKids] = useState<KidsPreference | null>(null);
  const [communicationStyle, setCommunicationStyle] = useState<CommunicationStyle | null>(null);
  const [loveStyle, setLoveStyle] = useState<LoveStyle | null>(null);
  const [drinking, setDrinking] = useState<LifestyleFrequency | null>(null);
  const [smoking, setSmoking] = useState<LifestyleFrequency | null>(null);
  const [exercise, setExercise] = useState<LifestyleFrequency | null>(null);
  const [pets, setPets] = useState<PetStatus | null>(null);
  const [socialMedia, setSocialMedia] = useState<LifestyleFrequency | null>(null);
  const [relationshipIntention, setRelationshipIntention] = useState<RelationshipIntention | null>(null);
  const [languages, setLanguages] = useState<string[]>(['tr']);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const interestsError = interests.isError ? errorMessage(interests.error) : null;

  useEffect(() => {
    if (!me.data?.profile) return;
    const profile = me.data.profile;
    setFirstName(profile.firstName);
    setUsername(profile.username);
    setGender(profile.gender);
    setBio(profile.bio ?? '');
    setHeightCm(profile.heightCm ? String(profile.heightCm) : '');
    setOccupation(profile.occupation ?? '');
    setEducationLevel(profile.educationLevel);
    const school = profile.education ?? '';
    if (school && (UNIVERSITIES as readonly string[]).includes(school)) {
      setUniversity(school);
      setUniversityCustom('');
    } else if (school) {
      setUniversity('__other__');
      setUniversityCustom(school);
    }
    setSexualOrientation(profile.sexualOrientation);
    setKids(profile.kids);
    setCommunicationStyle(profile.communicationStyle);
    setLoveStyle(profile.loveStyle);
    setDrinking(profile.drinking);
    setSmoking(profile.smoking);
    setExercise(profile.exercise);
    setPets(profile.pets);
    setSocialMedia(profile.socialMedia);
    setRelationshipIntention(profile.relationshipIntention);
    if (profile.languages.length > 0) setLanguages(profile.languages);
    setSelected(me.data.interests.map((item) => item.id));
  }, [me.data]);

  useEffect(() => {
    if (interestsError) showAlert(interestsError, 'Yüklenemedi');
  }, [interestsError]);

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
    const school = university === '__other__' ? universityCustom.trim() : university;
    const parsed = profileBasicsSchema.safeParse({
      firstName,
      username,
      gender: gender ?? undefined,
      bio,
      occupation,
      education: school,
      educationLevel: educationLevel ?? '',
      sexualOrientation: sexualOrientation ?? '',
      kids: kids ?? '',
      communicationStyle: communicationStyle ?? '',
      loveStyle: loveStyle ?? '',
      pets: pets ?? '',
      socialMedia: socialMedia ?? '',
      heightCm: heightCm || '',
      languages,
      relationshipIntention: relationshipIntention ?? '',
      drinking: drinking ?? '',
      smoking: smoking ?? '',
      exercise: exercise ?? '',
    });
    if (missing) {
      flagMissing(missing);
      return;
    }
    if (!parsed.success) {
      flagMissing(parsed.error.issues[0]?.message ?? 'Formu kontrol et.');
      return;
    }
    setBusy(true);
    try {
      const place = fromProfile ? null : await captureLocation(true);
      if (!fromProfile && !place) {
        flagMissing('Yakınınızdaki kişileri gösterebilmek için konum izni gerekir.');
        return;
      }
      await api('/profile/me', {
        method: 'PUT',
        body: {
          ...parsed.data,
          city: place?.city ?? me.data?.profile?.city ?? null,
          country: place?.country ?? me.data?.profile?.country ?? null,
        },
      });
      if (place) {
        await api('/profile/me/location', {
          method: 'PUT',
          body: {
            latitude: place.latitude,
            longitude: place.longitude,
            city: place.city,
            country: place.country,
          },
        });
      }
      await api('/profile/me/interests', { method: 'PUT', body: { interestIds: selected } });
      await queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      if (fromProfile) router.back();
      else router.push('/onboarding/photos');
    } catch (caught) {
      showAlert(errorMessage(caught), 'Devam edilemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header>
      <PageHeading icon="person" title="Kendini tanıt" />
      <ProfileMeter percent={percent} centered />
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
      <SelectField
        label="Cinsel yönelim"
        icon="heart"
        placeholder="Yönelim seçin"
        options={choices(SEXUAL_ORIENTATION_LABELS)}
        value={sexualOrientation}
        onChange={(next) => setSexualOrientation(next as SexualOrientation)}
      />
      <SelectField
        label="Boy"
        icon="resize"
        placeholder="Boy seçin"
        options={HEIGHTS}
        value={heightCm || null}
        onChange={setHeightCm}
      />
      <Field
        label="İş / çalıştığın yer"
        icon="briefcase"
        hint="Mesleğin ya da çalıştığın yer."
        value={occupation}
        onChangeText={setOccupation}
      />
      <SelectField
        label="Eğitim seviyesi"
        icon="school"
        placeholder="Eğitim seviyesi seçin"
        options={choices(EDUCATION_LEVEL_LABELS)}
        value={educationLevel}
        onChange={(next) => setEducationLevel(next as EducationLevel)}
      />
      <SelectField
        label="Üniversite"
        icon="library"
        placeholder="Üniversite seçin"
        options={UNIVERSITY_OPTIONS}
        value={university || null}
        onChange={setUniversity}
      />
      {university === '__other__' ? (
        <Field label="Üniversitenin adı" icon="create" value={universityCustom} onChangeText={setUniversityCustom} />
      ) : null}
      <BlockTitle>Kısaca ben</BlockTitle>
      {me.data ? <Field label="Burcun" icon="planet" value={ZODIAC_LABELS[me.data.zodiac]} editable={false} /> : null}
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
        label="Çocuk istiyor musun?"
        icon="happy"
        placeholder="Seçin"
        options={choices(KIDS_LABELS)}
        value={kids}
        onChange={(next) => setKids(next as KidsPreference)}
      />
      <SelectField
        label="İletişim tarzın"
        icon="chatbubbles"
        placeholder="Nasıl iletişim kurarsın?"
        options={choices(COMMUNICATION_LABELS)}
        value={communicationStyle}
        onChange={(next) => setCommunicationStyle(next as CommunicationStyle)}
      />
      <SelectField
        label="Aşkını nasıl ifade edersin?"
        icon="heart"
        placeholder="Seçin"
        options={choices(LOVE_LABELS)}
        value={loveStyle}
        onChange={(next) => setLoveStyle(next as LoveStyle)}
      />
      <BlockTitle>Yaşam tarzı</BlockTitle>
      <SelectField
        label="Evcil hayvanın var mı?"
        icon="paw"
        placeholder="Seçin"
        options={choices(PET_LABELS)}
        value={pets}
        onChange={(next) => setPets(next as PetStatus)}
      />
      <SelectField
        label="Ne sıklıkla içki içersin?"
        icon="wine"
        placeholder="Seçin"
        options={choices(DRINK_SMOKE_LABELS)}
        value={drinking}
        onChange={(next) => setDrinking(next as LifestyleFrequency)}
      />
      <SelectField
        label="Ne sıklıkla sigara içersin?"
        icon="flame"
        placeholder="Seçin"
        options={choices(DRINK_SMOKE_LABELS)}
        value={smoking}
        onChange={(next) => setSmoking(next as LifestyleFrequency)}
      />
      <SelectField
        label="Spor yapıyor musun?"
        icon="barbell"
        placeholder="Seçin"
        options={choices(EXERCISE_LABELS)}
        value={exercise}
        onChange={(next) => setExercise(next as LifestyleFrequency)}
      />
      <SelectField
        label="Sosyal medyada ne kadar aktifsin?"
        icon="phone-portrait"
        placeholder="Seçin"
        options={choices(SOCIAL_LABELS)}
        value={socialMedia}
        onChange={(next) => setSocialMedia(next as LifestyleFrequency)}
      />
      <BlockTitle>Ne arıyorsun</BlockTitle>
      <SelectField
        label="İlişki beklentin"
        icon="infinite"
        placeholder="Seçin"
        options={choices(INTENTION_LABELS)}
        value={relationshipIntention}
        onChange={(next) => setRelationshipIntention(next as RelationshipIntention)}
      />
      <SelectField
        label="Bildiğin diller"
        icon="language"
        placeholder={`En fazla ${MAX_LANGUAGES} dil`}
        multiple
        options={LANGUAGE_OPTIONS.map((item) => ({ value: item.code, label: item.label }))}
        values={languages}
        onChangeMany={(next) => setLanguages(next.slice(0, MAX_LANGUAGES))}
      />
      <SelectField
        label="İlgi alanları"
        icon="heart"
        placeholder={`En fazla ${MAX_INTERESTS} alan seçin`}
        multiple
        loading={interests.isPending}
        emptyText="İlgi alanı bulunamadı."
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

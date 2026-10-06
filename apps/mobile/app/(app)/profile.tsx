import type { InterestDto, MediaHitDto, MediaKind, MediaPickDto, MyProfileDto, PhotoDto, ProfileControlsDto, ProfileShowcaseDto, RelationshipIntention } from '@dating/types';
import { Ionicons } from '@expo/vector-icons';
import { MAX_BIO_LENGTH, MAX_INTERESTS } from '@dating/validation';
import { api, deviceUrl, errorMessage } from '@/api';
import { useTheme } from '@/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type ListField = keyof Pick<ProfileShowcaseDto, 'watched' | 'movies' | 'teams' | 'games' | 'songs' | 'artists'>;

const MEDIA_KIND: Record<ListField, MediaKind> = {
  watched: 'show',
  movies: 'movie',
  teams: 'team',
  games: 'game',
  songs: 'song',
  artists: 'artist',
};

const ORDERABLE = new Set(['PROCESSING', 'APPROVED', 'PENDING_REVIEW']);

type Sheet =
  | null
  | { kind: 'controls' }
  | { kind: 'preview' }
  | { kind: 'bio' }
  | { kind: 'obsession' }
  | { kind: 'interests' }
  | { kind: 'list'; field: ListField; title: string; placeholder: string };

const INTENTION_LABELS: Record<RelationshipIntention, string> = {
  LONG_TERM: 'Uzun süreli ilişki',
  LONG_TERM_OPEN_TO_SHORT: 'Uzun süreli, kısaya açık',
  SHORT_TERM_OPEN_TO_LONG: 'Kısa süreli, uzuna açık',
  SHORT_TERM: 'Kısa süreli',
  FRIENDSHIP: 'Yeni arkadaşlar',
  NOT_SURE: 'Henüz karar vermedim',
};

function previewNames(names: string[], empty: string): string {
  if (names.length === 0) return empty;
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')}, +${names.length - 3}`;
}

function joinPreview(items: MediaPickDto[], empty: string): string {
  return previewNames(items.map((item) => item.title), empty);
}

function lifestyleFilled(profile: NonNullable<MyProfileDto['profile']>): number {
  return [profile.drinking, profile.smoking, profile.exercise].filter(Boolean).length;
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['profile', 'me'], queryFn: () => api<MyProfileDto>('/profile/me') });
  const catalog = useQuery({ queryKey: ['interests'], queryFn: () => api<InterestDto[]>('/interests') });
  const { refetch } = me;
  const profile = me.data?.profile;
  const photos = (me.data?.photos ?? []).filter((item) => ORDERABLE.has(item.status));
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draft, setDraft] = useState('');
  const [draftList, setDraftList] = useState<MediaPickDto[]>([]);
  const [mediaQuery, setMediaQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const mediaKind = sheet?.kind === 'list' ? MEDIA_KIND[sheet.field] : null;
  const mediaHits = useQuery({
    queryKey: ['media-search', mediaKind, debouncedQuery],
    queryFn: () =>
      api<MediaHitDto[]>(`/media/search?kind=${mediaKind}&q=${encodeURIComponent(debouncedQuery)}`),
    enabled: mediaKind !== null,
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(mediaQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [mediaQuery]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  function close() {
    setSheet(null);
    setError(null);
  }

  async function save(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const next = await api<MyProfileDto>(path, { method: 'PUT', body });
      queryClient.setQueryData(['profile', 'me'], next);
      close();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function toggleControl(patch: Partial<ProfileControlsDto>) {
    if (!me.data) return;
    const previous = me.data;
    queryClient.setQueryData<MyProfileDto>(['profile', 'me'], { ...previous, controls: { ...previous.controls, ...patch } });
    try {
      const next = await api<MyProfileDto>('/profile/me/controls', { method: 'PUT', body: patch });
      queryClient.setQueryData(['profile', 'me'], next);
    } catch (caught) {
      queryClient.setQueryData(['profile', 'me'], previous);
      setError(errorMessage(caught));
    }
  }

  function openList(field: ListField, title: string, placeholder: string) {
    setDraftList([...(me.data?.showcase[field] ?? [])]);
    setMediaQuery('');
    setDebouncedQuery('');
    setError(null);
    setSheet({ kind: 'list', field, title, placeholder });
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (photoBusy || target < 0 || target >= photos.length) return;
    const ids = photos.map((item) => item.id);
    const next = [...ids];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    const previous = queryClient.getQueryData<MyProfileDto>(['profile', 'me']);
    if (previous) {
      const byId = new Map(previous.photos.map((item) => [item.id, item]));
      const reordered = next.flatMap((id) => {
        const photo = byId.get(id);
        return photo ? [photo] : [];
      });
      const rest = previous.photos.filter((item) => !next.includes(item.id));
      queryClient.setQueryData<MyProfileDto>(['profile', 'me'], { ...previous, photos: [...reordered, ...rest] });
    }
    setPhotoBusy(true);
    try {
      await api<PhotoDto[]>('/photos/order', { method: 'PUT', body: { ids: next } });
      await queryClient.invalidateQueries({ queryKey: ['photos'] });
    } catch (caught) {
      if (previous) queryClient.setQueryData(['profile', 'me'], previous);
      setError(errorMessage(caught));
    } finally {
      setPhotoBusy(false);
    }
  }

  const controls = me.data?.controls;
  const showcase = me.data?.showcase;
  const interests = me.data?.interests ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBottom }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar uri={photos[0]?.urls ? deviceUrl(photos[0].urls.thumb) : null} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }} numberOfLines={1}>
                {profile?.firstName ?? 'Profil'}
              </Text>
              {profile?.verificationStatus === 'VERIFIED' ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              ) : null}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setSheet({ kind: 'preview' })} hitSlop={8}>
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>Ön izleme ›</Text>
            </Pressable>
          </View>
          <CircleButton icon="people-outline" label="Profil önizleme" onPress={() => setSheet({ kind: 'preview' })} />
          <CircleButton icon="settings-outline" label="Ayarlar" onPress={() => router.push('/settings')} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {profile?.city ? <Chip icon="home-outline" label={profile.city} /> : null}
          {profile?.heightCm ? <Chip icon="create-outline" label={`${profile.heightCm} cm`} /> : null}
          {profile?.occupation ? <Chip icon="briefcase-outline" label={profile.occupation} /> : null}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip icon="grid-outline" label="Kısaca Ben" onPress={() => { setDraft(profile?.bio ?? ''); setSheet({ kind: 'bio' }); }} />
          {profile ? <Chip icon="wine-outline" label={`Yaşam Tarzı (${lifestyleFilled(profile)}/3)`} /> : null}
          {profile?.relationshipIntention ? (
            <Chip icon="infinite-outline" label={INTENTION_LABELS[profile.relationshipIntention]} />
          ) : null}
          {profile && profile.languages.length > 0 ? (
            <Chip icon="language-outline" label={profile.languages[0]?.toUpperCase() ?? ''} />
          ) : null}
        </ScrollView>

        <Section title="Fotoğraflarım">
          <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 10, gap: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {photos.length === 0 ? (
                <View style={{ width: 96, height: 128, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                </View>
              ) : (
                photos.map((photo, index) => (
                  <View key={photo.id} style={{ width: 96, height: 128 }}>
                    {photo.urls ? (
                      <Image
                        source={{ uri: deviceUrl(photo.urls.medium) }}
                        style={{ width: 96, height: 128, borderRadius: 16 }}
                        accessibilityIgnoresInvertColors
                      />
                    ) : (
                      <View style={{ width: 96, height: 128, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="time" size={24} color={colors.textMuted} />
                      </View>
                    )}
                    {photos.length > 1 ? (
                      <View style={{ position: 'absolute', left: 4, right: 4, bottom: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
                        {index > 0 ? (
                          <PhotoMove label="Sola al" icon="chevron-back" disabled={photoBusy} onPress={() => void movePhoto(index, -1)} />
                        ) : (
                          <View />
                        )}
                        {index < photos.length - 1 ? (
                          <PhotoMove label="Sağa al" icon="chevron-forward" disabled={photoBusy} onPress={() => void movePhoto(index, 1)} />
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingBottom: 4 }}>
              <Text style={{ color: colors.textMuted, flex: 1, fontSize: 14, lineHeight: 20 }}>
                {photos.length < 4
                  ? 'Uzman tavsiyesi: Fotoğraflarını daha da çeşitlendir. Sırayı oklarla değiştir.'
                  : 'Sırayı fotoğrafın üzerindeki oklarla değiştir.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/onboarding/photos', params: { from: 'profile' } })}
                style={{ backgroundColor: colors.text, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}
              >
                <Text style={{ color: colors.bgBottom, fontWeight: '700' }}>Düzenle</Text>
              </Pressable>
            </View>
          </View>
        </Section>

        <Section title="İpuçlarım">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PromptCard
              label="Hakkımda"
              value={profile?.bio?.trim() || 'Kendinden bahset'}
              onPress={() => {
                setDraft(profile?.bio ?? '');
                setError(null);
                setSheet({ kind: 'bio' });
              }}
            />
            <PromptCard
              label="Son zamanlardaki en büyük takıntım..."
              value={showcase?.obsession?.trim() || 'Bir cevap yaz'}
              onPress={() => {
                setDraft(showcase?.obsession ?? '');
                setError(null);
                setSheet({ kind: 'obsession' });
              }}
            />
          </View>
        </Section>

        <Section title="İlgi Alanlarım">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 4 }}>
            <InterestCard
              title="Mevcut ilgi alanları"
              subtitle={previewNames(interests.map((item) => item.name), 'İlgi alanı ekle')}
              icon="heart-outline"
              filled={interests.length > 0}
              onAdd={() => {
                setPicked(interests.map((item) => item.id));
                setError(null);
                setSheet({ kind: 'interests' });
              }}
            />
            <InterestCard
              title="İzledikleri"
              subtitle={joinPreview(showcase?.watched ?? [], 'Dizi ekle')}
              images={(showcase?.watched ?? []).map((item) => item.imageUrl)}
              icon="tv-outline"
              filled={(showcase?.watched.length ?? 0) > 0}
              onAdd={() => openList('watched', 'İzledikleri', 'Dizi adı')}
            />
            <InterestCard
              title="Sinema gecesi"
              subtitle={joinPreview(showcase?.movies ?? [], 'Film ekle')}
              images={(showcase?.movies ?? []).map((item) => item.imageUrl)}
              icon="film-outline"
              filled={(showcase?.movies.length ?? 0) > 0}
              onAdd={() => openList('movies', 'Sinema gecesi', 'Film adı')}
            />
            <InterestCard
              title="Tuttuğu takımlar"
              subtitle={joinPreview(showcase?.teams ?? [], 'Takım ekle')}
              images={(showcase?.teams ?? []).map((item) => item.imageUrl)}
              icon="football-outline"
              filled={(showcase?.teams.length ?? 0) > 0}
              onAdd={() => openList('teams', 'Tuttuğu takımlar', 'Takım adı')}
            />
            <InterestCard
              title="Oynadıkları"
              subtitle={joinPreview(showcase?.games ?? [], 'Oyun ekle')}
              images={(showcase?.games ?? []).map((item) => item.imageUrl)}
              icon="game-controller-outline"
              filled={(showcase?.games.length ?? 0) > 0}
              onAdd={() => openList('games', 'Oynadıkları', 'Oyun adı')}
            />
            <InterestCard
              title="Dinlediğim"
              subtitle={joinPreview(showcase?.songs ?? [], 'Şarkı ekle')}
              images={(showcase?.songs ?? []).map((item) => item.imageUrl)}
              icon="musical-notes"
              accent
              filled={(showcase?.songs.length ?? 0) > 0}
              onAdd={() => openList('songs', 'Dinlediğim', 'Şarkı adı')}
            />
            <InterestCard
              title="Sevilen sanatçılar"
              subtitle={joinPreview(showcase?.artists ?? [], 'Sanatçı ekle')}
              images={(showcase?.artists ?? []).map((item) => item.imageUrl)}
              icon="musical-note"
              accent
              filled={(showcase?.artists.length ?? 0) > 0}
              onAdd={() => openList('artists', 'Sevilen sanatçılar', 'Sanatçı adı')}
            />
          </View>
        </Section>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setError(null);
            setSheet({ kind: 'controls' });
          }}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 999,
            paddingVertical: 16,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Daha Fazla Profil Kontrolü</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/subscription')}
          style={{
            backgroundColor: colors.warning,
            borderRadius: 18,
            paddingVertical: 14,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Text style={{ color: colors.bgBottom, fontWeight: '800' }}>Plus</Text>
          <Text style={{ color: colors.bgBottom, flex: 1, fontSize: 13 }}>Seni kimlerin beğendiğini gör.</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.bgBottom} />
        </Pressable>
      </ScrollView>

      <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={close} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: `${colors.photoScrim}99` }} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 18,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16),
            gap: 14,
            maxHeight: '82%',
            elevation: 0,
            shadowOpacity: 0,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              onPress={close}
              hitSlop={10}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: sheet?.kind === 'controls' ? colors.surface2 : 'transparent',
              }}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' }}>
              {sheet?.kind === 'controls'
                ? 'Profil Ayarları'
                : sheet?.kind === 'preview'
                  ? 'Ön izleme'
                  : sheet?.kind === 'bio'
                    ? 'Hakkımda'
                    : sheet?.kind === 'obsession'
                      ? 'Takıntım'
                      : sheet?.kind === 'interests'
                        ? 'İlgi alanları'
                        : sheet?.kind === 'list'
                          ? sheet.title
                          : ''}
            </Text>
            <View style={{ width: 36 }} />
          </View>
          {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
            {sheet?.kind === 'controls' && controls ? (
              <View style={{ gap: 12 }}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Fotoğraflar</Text>
                <SettingRow label="Akıllı Fotoğraflar" icon="sparkles">
                  <ControlSwitch
                    label="Akıllı Fotoğraflar"
                    value={controls.smartPhotos}
                    onValueChange={(value) => void toggleControl({ smartPhotos: value })}
                  />
                </SettingRow>
                <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
                  Akıllı Fotoğraflar, profil fotoğraflarını sürekli test ederek ilk görünmeye en uygun olanı seçer.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    close();
                    router.push('/subscription');
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 6, paddingBottom: 2 }}
                >
                  <Ionicons name="eye-outline" size={22} color={colors.text} />
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 }}>Görünürlüğünü kontrol et</Text>
                  <PlusBadge />
                </Pressable>
                <SettingRow label="Yaşımı gizle" icon="calendar-outline">
                  <ControlSwitch
                    label="Yaşımı gizle"
                    value={controls.hideAge}
                    onValueChange={(value) => void toggleControl({ hideAge: value })}
                  />
                </SettingRow>
                <SettingRow label="Mesafemi gizle" icon="location-outline">
                  <ControlSwitch
                    label="Mesafemi gizle"
                    value={controls.hideDistance}
                    onValueChange={(value) => void toggleControl({ hideDistance: value })}
                  />
                </SettingRow>
              </View>
            ) : null}
            {sheet?.kind === 'preview' && profile && me.data ? (
              <View style={{ gap: 10 }}>
                {photos[0]?.urls ? (
                  <Image source={{ uri: deviceUrl(photos[0].urls.large) }} style={{ width: '100%', aspectRatio: 0.8, borderRadius: 20 }} accessibilityIgnoresInvertColors />
                ) : null}
                <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
                  {profile.firstName}
                  {controls?.hideAge ? '' : `, ${me.data.age}`}
                </Text>
                {profile.bio ? <Text style={{ color: colors.text, fontSize: 16 }}>{profile.bio}</Text> : null}
                {showcase?.obsession ? <Text style={{ color: colors.textMuted }}>{showcase.obsession}</Text> : null}
                <Text style={{ color: colors.textMuted }}>
                  {controls?.hideDistance ? 'Mesafen diğer kişilere gösterilmez.' : 'Mesafen yaklaşık kilometre olarak görünür.'}
                </Text>
              </View>
            ) : null}
            {sheet?.kind === 'bio' || sheet?.kind === 'obsession' ? (
              <View style={{ gap: 12 }}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  maxLength={sheet.kind === 'bio' ? MAX_BIO_LENGTH : 80}
                  placeholder={sheet.kind === 'bio' ? 'Kendinden bahset' : 'Kısa bir cevap'}
                  placeholderTextColor={colors.textMuted}
                  style={{
                    minHeight: 120,
                    color: colors.text,
                    backgroundColor: colors.surface2,
                    borderRadius: 16,
                    padding: 14,
                    fontSize: 16,
                    textAlignVertical: 'top',
                  }}
                />
                <SaveButton
                  busy={busy}
                  onPress={() => {
                    if (sheet.kind === 'bio' && profile) {
                      void save('/profile/me', {
                        firstName: profile.firstName,
                        username: profile.username,
                        gender: profile.gender,
                        bio: draft,
                        city: profile.city,
                        country: profile.country,
                        occupation: profile.occupation,
                        education: profile.education,
                        heightCm: profile.heightCm,
                        languages: profile.languages,
                        relationshipIntention: profile.relationshipIntention,
                        drinking: profile.drinking,
                        smoking: profile.smoking,
                        exercise: profile.exercise,
                      });
                      return;
                    }
                    void save('/profile/me/showcase', { obsession: draft });
                  }}
                />
              </View>
            ) : null}
            {sheet?.kind === 'list' ? (
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {draftList.map((item) => (
                    <Pressable
                      key={item.title}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title} sil`}
                      onPress={() => setDraftList((current) => current.filter((value) => value.title !== item.title))}
                      style={{ backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
                    >
                      <Text style={{ color: colors.text }}>{item.title} ×</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={mediaQuery}
                  onChangeText={setMediaQuery}
                  placeholder={sheet.placeholder}
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  style={{ color: colors.text, backgroundColor: colors.surface2, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 }}
                />
                {mediaHits.isPending ? <Text style={{ color: colors.textMuted }}>Aranıyor…</Text> : null}
                {mediaHits.isError ? <Text style={{ color: colors.danger }}>{errorMessage(mediaHits.error)}</Text> : null}
                {(mediaHits.data ?? []).map((hit) => {
                  const on = draftList.some((item) => item.title === hit.title);
                  return (
                    <Pressable
                      key={hit.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() =>
                        setDraftList((current) => {
                          if (current.some((item) => item.title === hit.title)) {
                            return current.filter((item) => item.title !== hit.title);
                          }
                          if (current.length >= 8) return current;
                          return [...current, { title: hit.title, imageUrl: hit.imageUrl }];
                        })
                      }
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}
                    >
                      {hit.imageUrl ? (
                        <Image source={{ uri: hit.imageUrl }} style={{ width: 48, height: 64, borderRadius: 8 }} accessibilityIgnoresInvertColors />
                      ) : (
                        <View style={{ width: 48, height: 64, borderRadius: 8, backgroundColor: colors.surface2 }} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: on ? colors.primary : colors.text, fontWeight: '700' }}>{hit.title}</Text>
                        {hit.subtitle ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>{hit.subtitle}</Text> : null}
                      </View>
                      <Ionicons name={on ? 'checkmark-circle' : 'add-circle-outline'} size={22} color={on ? colors.primary : colors.textMuted} />
                    </Pressable>
                  );
                })}
                <SaveButton busy={busy} onPress={() => void save('/profile/me/showcase', { [sheet.field]: draftList })} />
              </View>
            ) : null}
            {sheet?.kind === 'interests' ? (
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(catalog.data ?? []).map((item) => {
                    const on = picked.includes(item.id);
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() =>
                          setPicked((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : current.length >= MAX_INTERESTS
                                ? current
                                : [...current, item.id],
                          )
                        }
                        style={{
                          backgroundColor: on ? colors.primary : colors.surface2,
                          borderRadius: 999,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ color: on ? colors.onAccent : colors.text }}>{item.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <SaveButton busy={busy} onPress={() => void save('/profile/me/interests', { interestIds: picked })} />
              </View>
            ) : null}
          </ScrollView>
        </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Avatar({ uri }: { uri: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: colors.surface2 }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person" size={28} color={colors.textMuted} />
        </View>
      )}
    </View>
  );
}

function CircleButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

function Chip({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.surface,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={{ color: colors.text, fontSize: 13 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{title}</Text>
      {children}
    </View>
  );
}

function PromptCard({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ flex: 1, minHeight: 150, backgroundColor: colors.surface, borderRadius: 22, padding: 14, justifyContent: 'space-between' }}
    >
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }} numberOfLines={3}>
          {value}
        </Text>
      </View>
      <View style={{ alignSelf: 'flex-end', width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="pencil" size={14} color={colors.text} />
      </View>
    </Pressable>
  );
}

function PhotoMove({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${colors.photoScrim}CC`, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={16} color={colors.onPhoto} />
    </Pressable>
  );
}

function InterestCard({
  title,
  subtitle,
  icon,
  filled,
  accent = false,
  images = [],
  onAdd,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  filled: boolean;
  accent?: boolean;
  images?: Array<string | null>;
  onAdd: () => void;
}) {
  const { colors } = useTheme();
  const tint = accent ? colors.success : colors.textMuted;
  const posters = images.filter((item): item is string => Boolean(item)).slice(0, 2);
  return (
    <View style={{ width: '47%', paddingTop: 12 }}>
      <Pressable
        accessibilityRole="button"
        onPress={onAdd}
        style={{ minHeight: 168, backgroundColor: colors.surface, borderRadius: 22, padding: 14, justifyContent: filled ? 'flex-start' : 'center', gap: 8 }}
      >
        {!filled ? <Ionicons name={icon} size={28} color={tint} style={{ alignSelf: 'center' }} /> : null}
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', textAlign: filled ? 'left' : 'center' }}>{title}</Text>
        <Text style={{ color: accent && !filled ? colors.success : colors.textMuted, fontSize: 13, textAlign: filled ? 'left' : 'center' }}>
          {subtitle}
        </Text>
        {posters.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {posters.map((uri) => (
              <Image key={uri} source={{ uri }} style={{ width: 44, height: 60, borderRadius: 8 }} accessibilityIgnoresInvertColors />
            ))}
          </View>
        ) : filled ? (
          <Ionicons name={icon} size={28} color={tint} />
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} ekle`}
        onPress={onAdd}
        style={{
          position: 'absolute',
          top: 0,
          right: 8,
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="add" size={20} color={colors.bgBottom} />
      </Pressable>
    </View>
  );
}

function SettingRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface2,
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{label}</Text>
      {children}
    </View>
  );
}

function PlusBadge() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.danger,
        borderRadius: 8,
        paddingLeft: 6,
        paddingRight: 8,
        paddingVertical: 4,
      }}
    >
      <Ionicons name="flame" size={13} color={colors.onPhoto} />
      <Text style={{ color: colors.onPhoto, fontSize: 12, fontWeight: '800' }}>Plus</Text>
    </View>
  );
}

function ControlSwitch({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: colors.textMuted, true: colors.danger }}
      thumbColor={colors.onPhoto}
      ios_backgroundColor={colors.textMuted}
    />
  );
}

function SaveButton({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={{ backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', opacity: busy ? 0.7 : 1 }}
    >
      <Text style={{ color: colors.onAccent, fontWeight: '800' }}>{busy ? 'Kaydediliyor' : 'Kaydet'}</Text>
    </Pressable>
  );
}

import type { PhotoDto } from '@dating/types';
import { Ionicons } from '@expo/vector-icons';
import { MAX_VIDEO_SECONDS, MEDIA_CONTENT_TYPES, type MediaContentType } from '@dating/validation';
import { api, deviceUrl, errorMessage, uploadPhotoContent } from '@/api';
import { PageHeading, PrimaryButton, Screen, SecondaryButton, StepBack, flagMissing, showAlert } from '@/ui';
import { useTheme } from '@/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, Text, View } from 'react-native';

const SLOT_COUNT = 9;

function mediaTypeOf(mime: string | null | undefined): MediaContentType | null {
  if (mime === 'image/jpg') return 'image/jpeg';
  if (mime && (MEDIA_CONTENT_TYPES as readonly string[]).includes(mime)) return mime as MediaContentType;
  return null;
}

function isVideoType(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith('video/'));
}

function dropSlot(from: number, dx: number, dy: number, count: number, width: number): number {
  const gap = 8;
  const cell = width > 0 ? (width - gap * 2) / 3 : 0;
  if (cell <= 0 || count < 1) return from;
  const stride = cell + gap;
  const col = from % 3;
  const row = Math.floor(from / 3);
  const x = col * stride + dx + cell / 2;
  const y = row * stride + dy + cell / 2;
  const nextCol = Math.max(0, Math.min(2, Math.floor(x / stride)));
  const nextRow = Math.max(0, Math.min(2, Math.floor(y / stride)));
  return Math.max(0, Math.min(count - 1, nextRow * 3 + nextCol));
}

function secondsOf(duration: number | null | undefined): number | null {
  if (duration == null || duration <= 0) return null;
  return duration > 100 ? duration / 1000 : duration;
}

function VideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />;
}

async function byteSize(uri: string, known: number | null | undefined): Promise<number> {
  if (known && known > 0) return known;
  const response = await fetch(uri);
  const blob = await response.blob();
  if (!blob.size) throw new Error('empty');
  return blob.size;
}

export default function OnboardingPhotos() {
  const { colors, ui } = useTheme();
  const router = useRouter();
  const fromProfile = useLocalSearchParams<{ from?: string }>().from === 'profile';
  const queryClient = useQueryClient();
  const photos = useQuery({ queryKey: ['photos'], queryFn: () => api<PhotoDto[]>('/photos') });
  const [localUris, setLocalUris] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const [drag, setDrag] = useState<{ index: number; dx: number; dy: number } | null>(null);
  const ordered = [...(photos.data ?? [])].sort((a, b) => a.position - b.position);
  const selectedIndex = ordered.findIndex((photo) => photo.id === selectedId);
  const orderedRef = useRef(ordered);
  const busyRef = useRef(busy);
  const gridWidthRef = useRef(0);
  const touches = useRef<Record<number, number>>({});
  const dragged = useRef(false);
  const reorderRef = useRef<(ids: string[]) => void>(() => undefined);
  orderedRef.current = ordered;
  busyRef.current = busy;
  gridWidthRef.current = gridWidth;

  const cellPans = useMemo(
    () =>
      Array.from({ length: SLOT_COUNT }, (_, index) => {
        let armed = false;
        return PanResponder.create({
          onMoveShouldSetPanResponder: (_, gesture) => {
            if (busyRef.current || orderedRef.current.length < 2 || !orderedRef.current[index]) return false;
            const held = Date.now() - (touches.current[index] ?? 0) > 280;
            if (!held) return false;
            return Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3;
          },
          onPanResponderTerminationRequest: () => !armed,
          onPanResponderGrant: () => {
            armed = true;
            dragged.current = true;
            setSelectedId(null);
            setDrag({ index, dx: 0, dy: 0 });
          },
          onPanResponderMove: (_, gesture) => {
            if (!armed) return;
            setDrag({ index, dx: gesture.dx, dy: gesture.dy });
          },
          onPanResponderRelease: (_, gesture) => {
            if (armed) {
              const list = orderedRef.current;
              const to = dropSlot(index, gesture.dx, gesture.dy, list.length, gridWidthRef.current);
              if (to !== index) {
                const ids = list.map((item) => item.id);
                const next = [...ids];
                const [moved] = next.splice(index, 1);
                if (moved) {
                  next.splice(to, 0, moved);
                  void reorderRef.current(next);
                }
              }
            }
            armed = false;
            setDrag(null);
          },
          onPanResponderTerminate: () => {
            armed = false;
            dragged.current = false;
            setDrag(null);
          },
        });
      }),
    [],
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['photos'] });
  }

  async function addPhoto() {
    if (ordered.length >= SLOT_COUNT) {
      flagMissing('En fazla 9 fotoğraf ekleyebilirsiniz.');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      flagMissing('Fotoğraf eklemek için galeri izni gerekir.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
      exif: false,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const video = asset.type === 'video' || isVideoType(asset.mimeType);
    const seconds = secondsOf(asset.duration);
    if (video && seconds !== null && seconds > MAX_VIDEO_SECONDS) {
      flagMissing('Video en fazla 15 saniye olabilir.');
      return;
    }
    const contentType = mediaTypeOf(asset.mimeType) ?? (video ? 'video/mp4' : 'image/jpeg');
    if (!video && asset.mimeType && !mediaTypeOf(asset.mimeType)) {
      flagMissing('Fotoğraf veya en fazla 15 saniyelik video seçin.');
      return;
    }
    setBusy(true);
    try {
      const size = await byteSize(asset.uri, asset.fileSize);
      const created = await api<{ photo: PhotoDto; upload: { url: string; fields: Record<string, string> } }>(
        '/photos/upload-url',
        { method: 'POST', body: { contentType, size } },
      );
      await uploadPhotoContent(created.photo.id, {
        uri: asset.uri,
        name: video ? 'clip.mp4' : 'photo.jpg',
        type: contentType,
      });
      await api(`/photos/${created.photo.id}/complete`, { method: 'POST' });
      setLocalUris((current) => ({ ...current, [created.photo.id]: asset.uri }));
      await refresh();
    } catch (caught) {
      showAlert(errorMessage(caught), 'Fotoğraf eklenemedi');
    } finally {
      setBusy(false);
    }
  }

  async function reorder(ids: string[]) {
    setBusy(true);
    try {
      await api('/photos/order', { method: 'PUT', body: { ids } });
      setSelectedId(null);
      await refresh();
    } catch (caught) {
      showAlert(errorMessage(caught), 'Sıra değişmedi');
    } finally {
      setBusy(false);
    }
  }
  reorderRef.current = reorder;

  function onSlot(index: number) {
    const photo = ordered[index];
    if (!photo) {
      setSelectedId(null);
      void addPhoto();
      return;
    }
    if (!selectedId || selectedId === photo.id) {
      setSelectedId(selectedId === photo.id ? null : photo.id);
      return;
    }
    const ids = ordered.map((item) => item.id);
    const from = ids.indexOf(selectedId);
    const to = ids.indexOf(photo.id);
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    void reorder(next);
  }

  async function removeSelected() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api(`/photos/${selectedId}`, { method: 'DELETE' });
      setSelectedId(null);
      await refresh();
    } catch (caught) {
      showAlert(errorMessage(caught), 'Fotoğraf silinemedi');
    } finally {
      setBusy(false);
    }
  }

  function moveSelected(direction: -1 | 1) {
    if (selectedIndex < 0) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= ordered.length) return;
    const ids = ordered.map((item) => item.id);
    const next = [...ids];
    const [moved] = next.splice(selectedIndex, 1);
    if (moved) next.splice(target, 0, moved);
    void reorder(next);
  }

  const ready = ordered.some(
    (photo) => photo.status === 'PROCESSING' || photo.status === 'APPROVED' || photo.status === 'PENDING_REVIEW',
  );

  return (
    <Screen header>
      <Stack.Screen
        options={{
          headerLeft: () =>
            fromProfile ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Geri" hitSlop={12} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </Pressable>
            ) : (
              <StepBack href="/onboarding/profile" />
            ),
        }}
      />
      <PageHeading
        icon="camera"
        title="Profil fotoğrafları"
        subtitle="Basılı tutup sürükleyerek sırayı değiştir. İlk fotoğraf kapaktır."
      />
      <View
        style={{ gap: 8 }}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          gridWidthRef.current = width;
          setGridWidth((current) => (current === width ? current : width));
        }}
      >
        {[0, 1, 2].map((row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 8 }}>
            {[0, 1, 2].map((column) => {
          const index = row * 3 + column;
          const photo = ordered[index];
          const uri = photo ? (localUris[photo.id] ?? (photo.urls ? deviceUrl(photo.urls.medium) : null)) : null;
          const video = isVideoType(photo?.contentType) || Boolean(uri?.includes('.mp4'));
          const cover = index === 0;
          const selected = photo?.id === selectedId;
          const dragging = drag?.index === index;
          const target = drag ? dropSlot(drag.index, drag.dx, drag.dy, ordered.length, gridWidth) : -1;
          const cellStyle = [
            ui.photoCell,
            { flex: 1, aspectRatio: 1 },
            cover && ui.photoCover,
            (selected || index === target) && ui.photoSelected,
            dragging
              ? { zIndex: 2, transform: [{ translateX: drag.dx }, { translateY: drag.dy }, { scale: 1.04 }] }
              : null,
          ];
          const media = uri && video ? (
            <VideoThumb uri={uri} />
          ) : uri ? (
            <Image source={{ uri }} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
          ) : (
            <Ionicons name={photo ? 'time' : 'add'} size={28} color={colors.textMuted} />
          );
          if (!photo) {
            return (
              <Pressable
                key={`empty-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Boş kare ${index + 1}`}
                disabled={busy}
                onPress={() => onSlot(index)}
                style={cellStyle}
              >
                {media}
              </Pressable>
            );
          }
          return (
            <View
              key={photo.id}
              accessibilityRole="button"
              accessibilityLabel={cover ? 'Kapak fotoğrafı' : `Fotoğraf ${index + 1}`}
              accessibilityHint="Sırayı değiştirmek için basılı tutup sürükle"
              onTouchStart={() => {
                touches.current[index] = Date.now();
              }}
              onTouchEnd={() => {
                if (!dragged.current) onSlot(index);
                dragged.current = false;
              }}
              {...cellPans[index]?.panHandlers}
              style={cellStyle}
            >
              <View pointerEvents="none" style={{ flex: 1, width: '100%' }}>
                {media}
              </View>
              {cover ? (
                <View style={[ui.photoBadge, ui.photoBadgeTop]}>
                  <Text style={ui.photoBadgeText}>Kapak</Text>
                </View>
              ) : null}
              {photo.status === 'REJECTED' ? (
                <View style={[ui.photoBadge, ui.photoBadgeBottom]}>
                  <Text style={ui.photoBadgeText}>Reddedildi</Text>
                </View>
              ) : null}
            </View>
            );
            })}
          </View>
        ))}
      </View>
      {selectedId ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <SecondaryButton label="Öne al" onPress={() => moveSelected(-1)} />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton label="Arkaya al" onPress={() => moveSelected(1)} />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton label="Sil" onPress={() => void removeSelected()} />
          </View>
        </View>
      ) : (
        busy ? <Text style={[ui.hint, ui.centered]}>Fotoğrafın ekleniyor.</Text> : null
      )}
      <PrimaryButton
        label={fromProfile ? 'Bitti' : 'Devam et'}
        disabled={busy}
        onPress={() => {
          if (fromProfile) {
            router.back();
            return;
          }
          if (!ready) {
            flagMissing(
              ordered.some((photo) => photo.status === 'REJECTED')
                ? 'Devam etmek için uygun bir profil fotoğrafı ekleyin.'
                : 'Devam etmek için en az bir profil fotoğrafı ekleyin.',
            );
            return;
          }
          router.replace('/onboarding/preferences');
        }}
      />
    </Screen>
  );
}

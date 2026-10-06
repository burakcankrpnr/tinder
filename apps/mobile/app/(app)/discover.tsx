import type { DiscoveryCardDto, DiscoveryFeedDto, SwipeResultDto } from '@dating/types';
import { Ionicons } from '@expo/vector-icons';
import { api, deviceUrl, errorMessage } from '@/api';
import { ErrorText, showAlert } from '@/ui';
import { useTheme } from '@/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function CardVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />;
}

function CardMedia({ uri, video }: { uri: string; video: boolean }) {
  if (video) return <CardVideo uri={uri} />;
  return <Image source={{ uri }} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />;
}

function SuperLikeMark({ size }: { size: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="star" size={size} color={colors.primary} />
      <View style={{ position: 'absolute', top: -2, right: -4 }}>
        <Ionicons name="sparkles" size={Math.round(size * 0.42)} color={colors.warning} />
      </View>
    </View>
  );
}

function RoundAction({
  label,
  disabled,
  onPress,
  tone,
  strength,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  tone: 'pass' | 'like' | 'super';
  strength: number;
}) {
  const { colors, ui } = useTheme();
  const style = tone === 'like' ? ui.actionLike : tone === 'super' ? ui.actionSuper : ui.actionPass;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[style, { opacity: disabled ? 0.5 : strength, transform: [{ scale: 0.92 + Math.min(strength, 1.4) * 0.16 }] }]}
    >
      {tone === 'super' ? (
        <SuperLikeMark size={28} />
      ) : (
        <Ionicons name={tone === 'like' ? 'heart' : 'close'} size={tone === 'like' ? 30 : 28} color={tone === 'like' ? colors.onAccent : colors.danger} />
      )}
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const { colors, ui } = useTheme();
  const queryClient = useQueryClient();
  const feed = useQuery({ queryKey: ['discovery'], queryFn: () => api<DiscoveryFeedDto>('/discovery?limit=10') });
  const { refetch } = feed;
  const [skipped, setSkipped] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cards = (feed.data?.cards ?? []).filter((card) => !skipped.includes(card.id));
  const card = cards[0];
  const [photoIndex, setPhotoIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const cardRef = useRef(card);
  const busyRef = useRef(busy);
  const swipeRef = useRef<(action: 'LIKE' | 'PASS' | 'SUPER_LIKE', target: DiscoveryCardDto) => Promise<void>>(
    async () => undefined,
  );
  cardRef.current = card;
  busyRef.current = busy;

  useEffect(() => {
    setPhotoIndex(0);
    setDragX(0);
    setDragY(0);
  }, [card?.id]);

  function claimSwipe(dx: number, dy: number): boolean {
    if (busyRef.current) return false;
    const horizontal = Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy);
    const upward = dy < -14 && Math.abs(dy) > Math.abs(dx);
    return horizontal || upward;
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => claimSwipe(gesture.dx, gesture.dy),
      onMoveShouldSetPanResponderCapture: (_, gesture) => claimSwipe(gesture.dx, gesture.dy),
      onPanResponderMove: (_, gesture) => {
        setDragX(gesture.dx);
        setDragY(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        const current = cardRef.current;
        setDragX(0);
        setDragY(0);
        if (!current || busyRef.current) return;
        if (gesture.dy < -110 && Math.abs(gesture.dy) > Math.abs(gesture.dx)) {
          void swipeRef.current('SUPER_LIKE', current);
          return;
        }
        if (gesture.dx > 110 && Math.abs(gesture.dx) >= Math.abs(gesture.dy)) {
          void swipeRef.current('LIKE', current);
          return;
        }
        if (gesture.dx < -110 && Math.abs(gesture.dx) >= Math.abs(gesture.dy)) {
          void swipeRef.current('PASS', current);
        }
      },
      onPanResponderTerminate: () => {
        setDragX(0);
        setDragY(0);
      },
    }),
  ).current;

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  async function swipe(action: 'LIKE' | 'PASS' | 'SUPER_LIKE', target: DiscoveryCardDto) {
    setBusy(true);
    setError(null);
    try {
      const result = await api<SwipeResultDto>('/swipes', {
        method: 'POST',
        body: { targetUserId: target.id, action },
      });
      setSkipped((current) => [...current, target.id]);
      if (result.match) {
        showAlert(`${result.match.user.firstName} ile eşleştiniz. Eşleşmeler sekmesinden yazabilirsiniz.`, 'Eşleşme');
        void queryClient.invalidateQueries({ queryKey: ['matches'] });
      }
      if (cards.length < 3) void queryClient.invalidateQueries({ queryKey: ['discovery'] });
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      showAlert(message, 'İşlem olmadı');
    } finally {
      setBusy(false);
    }
  }
  swipeRef.current = swipe;

  function showPhoto(step: -1 | 1) {
    if (!card || card.photos.length < 2) return;
    setPhotoIndex((index) => {
      const next = index + step;
      if (next < 0 || next >= card.photos.length) return index;
      return next;
    });
  }

  const draggingUp = dragY < -8 && Math.abs(dragY) > Math.abs(dragX);
  const likeOpacity = draggingUp ? 0 : Math.min(1, Math.max(0, dragX / 80));
  const passOpacity = draggingUp ? 0 : Math.min(1, Math.max(0, -dragX / 80));
  const superOpacity = draggingUp ? Math.min(1, Math.max(0, -dragY / 80)) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBottom }} edges={['top']}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
        <Text style={ui.title}>Keşfet</Text>
        <ErrorText>{error}</ErrorText>
        {!card ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <View style={ui.pageIcon}>
              <Ionicons name="compass" size={26} color={colors.onAccent} />
            </View>
            <Text style={[ui.subtitle, ui.centered]}>
              {feed.isLoading ? 'Yükleniyor.' : 'Şu an gösterilecek kimse yok. Tercihlerinizi genişletebilirsiniz.'}
            </Text>
          </View>
        ) : (
          <View
            style={[
              ui.card,
              {
                flex: 1,
                transform: [{ translateX: dragX }, { translateY: Math.min(0, dragY) }, { rotate: `${dragX / 24}deg` }],
              },
            ]}
            {...pan.panHandlers}
          >
            <View style={{ flex: 1 }}>
              {card.photos[photoIndex] ? (
                <CardMedia
                  uri={deviceUrl(card.photos[photoIndex].urls.large)}
                  video={card.photos[photoIndex].contentType?.startsWith('video/') ?? false}
                />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="image" size={40} color={colors.textMuted} />
                </View>
              )}
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', top: 72, left: 22, opacity: likeOpacity, transform: [{ rotate: '-14deg' }] }}>
              <View style={{ borderWidth: 3, borderColor: colors.success, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', gap: 2 }}>
                <Ionicons name="heart" size={36} color={colors.success} />
                <Text style={{ color: colors.success, fontWeight: '800', letterSpacing: 1 }}>BEĞEN</Text>
              </View>
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', top: 72, right: 22, opacity: passOpacity, transform: [{ rotate: '14deg' }] }}>
              <View style={{ borderWidth: 3, borderColor: colors.danger, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', gap: 2 }}>
                <Ionicons name="close" size={36} color={colors.danger} />
                <Text style={{ color: colors.danger, fontWeight: '800', letterSpacing: 1 }}>GEÇ</Text>
              </View>
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', top: 78, left: 0, right: 0, alignItems: 'center', opacity: superOpacity }}>
              <View style={{ borderWidth: 3, borderColor: colors.primary, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', gap: 4, backgroundColor: `${colors.photoScrim}CC` }}>
                <SuperLikeMark size={40} />
                <Text style={{ color: colors.primary, fontWeight: '800', letterSpacing: 1 }}>SUPER LIKE</Text>
              </View>
            </View>
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Önceki fotoğraf"
                style={{ flex: 1 }}
                onPress={() => showPhoto(-1)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sonraki fotoğraf"
                style={{ flex: 1 }}
                onPress={() => showPhoto(1)}
              />
            </View>
            {card.photos.length > 1 ? (
              <View style={{ position: 'absolute', top: 12, left: 16, right: 16, flexDirection: 'row', gap: 4 }}>
                {card.photos.map((photo, index) => (
                  <View
                    key={photo.id}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 999,
                      backgroundColor: index === photoIndex ? colors.onPhoto : `${colors.onPhoto}55`,
                    }}
                  />
                ))}
              </View>
            ) : null}
            <View style={ui.overlay}>
              {card.superLikedYou ? (
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Sizi Super Like ile beğendi</Text>
              ) : null}
              <Text style={{ color: colors.onPhoto, fontSize: 28, fontWeight: '700' }}>
                {card.firstName}
                {card.age != null ? `, ${card.age}` : ''}
              </Text>
              {card.distanceKm != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="navigate" size={16} color={colors.onPhotoMuted} />
                  <Text style={[ui.subtitle, { color: colors.onPhotoMuted }]}>{card.distanceKm} km uzakta</Text>
                </View>
              ) : null}
              {card.bio ? <Text style={{ color: colors.onPhoto, fontSize: 15 }} numberOfLines={2}>{card.bio}</Text> : null}
            </View>
          </View>
        )}
        {card ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18 }}>
            <RoundAction
              tone="pass"
              label="Geç"
              disabled={busy}
              strength={passOpacity > 0.05 ? 1.35 : draggingUp ? 0.4 : 1}
              onPress={() => void swipe('PASS', card)}
            />
            <RoundAction
              tone="super"
              label="Super Like"
              disabled={busy}
              strength={superOpacity > 0.05 ? 1.4 : Math.abs(dragX) > 8 ? 0.4 : 1}
              onPress={() => void swipe('SUPER_LIKE', card)}
            />
            <RoundAction
              tone="like"
              label="Beğen"
              disabled={busy}
              strength={likeOpacity > 0.05 ? 1.35 : draggingUp ? 0.4 : 1}
              onPress={() => void swipe('LIKE', card)}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

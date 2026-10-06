import type { DiscoveryCardDto, DiscoveryFeedDto, SwipeResultDto } from '@dating/types';
import { api, deviceUrl, errorMessage } from '@/api';
import { ErrorText, PrimaryButton, SecondaryButton } from '@/ui';
import { colors, ui } from '@/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function CardVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });
  return <VideoView player={player} style={{ width: '100%', height: 360 }} contentFit="cover" nativeControls={false} />;
}

function CardMedia({ uri, video }: { uri: string; video: boolean }) {
  if (video) return <CardVideo uri={uri} />;
  return <Image source={{ uri }} style={{ width: '100%', height: 360 }} accessibilityIgnoresInvertColors />;
}

export default function DiscoverScreen() {
  const queryClient = useQueryClient();
  const feed = useQuery({ queryKey: ['discovery'], queryFn: () => api<DiscoveryFeedDto>('/discovery?limit=10') });
  const [skipped, setSkipped] = useState<string[]>([]);
  const [matchName, setMatchName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cards = (feed.data?.cards ?? []).filter((card) => !skipped.includes(card.id));
  const card = cards[0];
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    setPhotoIndex(0);
  }, [card?.id]);

  async function swipe(action: 'LIKE' | 'PASS' | 'SUPER_LIKE', target: DiscoveryCardDto) {
    setBusy(true);
    setError(null);
    setMatchName(null);
    try {
      const result = await api<SwipeResultDto>('/swipes', {
        method: 'POST',
        body: { targetUserId: target.id, action },
      });
      setSkipped((current) => [...current, target.id]);
      if (result.match) setMatchName(result.match.user.firstName);
      if (cards.length < 3) void queryClient.invalidateQueries({ queryKey: ['discovery'] });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBottom }} edges={['top']}>
      <View style={ui.screen}>
        <Text style={ui.title}>Keşfet</Text>
        <ErrorText>{error}</ErrorText>
        {matchName ? <Text style={{ color: colors.success }}>Eşleştin: {matchName}</Text> : null}
        {!card ? (
          <Text style={ui.subtitle}>
            {feed.isLoading ? 'Yükleniyor…' : 'Şu an gösterilecek kimse yok. Tercihlerini genişletebilirsin.'}
          </Text>
        ) : (
          <View style={ui.card}>
            {card.photos[photoIndex] ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sonraki fotoğraf"
                onPress={() => setPhotoIndex((index) => (index + 1) % card.photos.length)}
              >
                <CardMedia
                  uri={deviceUrl(card.photos[photoIndex].urls.large)}
                  video={card.photos[photoIndex].contentType?.startsWith('video/') ?? false}
                />
              </Pressable>
            ) : null}
            {card.photos.length > 1 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 8 }}>
                {card.photos.map((photo, index) => (
                  <View
                    key={photo.id}
                    style={{
                      width: index === photoIndex ? 16 : 6,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: index === photoIndex ? colors.primary : colors.surface2,
                    }}
                  />
                ))}
              </View>
            ) : null}
            <View style={{ padding: 16, gap: 6 }}>
              <Text style={ui.title}>
                {card.firstName}, {card.age}
              </Text>
              <Text style={ui.subtitle}>
                {card.distanceKm} km uzakta
              </Text>
              {card.bio ? <Text style={{ color: colors.text }}>{card.bio}</Text> : null}
              {card.superLikedYou ? <Text style={{ color: colors.primary }}>Seni super like'ladı</Text> : null}
            </View>
          </View>
        )}
        {card ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Geç" onPress={() => void swipe('PASS', card)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Beğen" disabled={busy} onPress={() => void swipe('LIKE', card)} />
            </View>
          </View>
        ) : null}
        {card ? <SecondaryButton label="Super Like" onPress={() => void swipe('SUPER_LIKE', card)} /> : null}
      </View>
    </SafeAreaView>
  );
}

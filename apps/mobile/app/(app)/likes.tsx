import type { LikesReceivedDto } from '@dating/types';
import { Ionicons } from '@expo/vector-icons';
import { api, deviceUrl, errorMessage } from '@/api';
import { showAlert } from '@/ui';
import { useTheme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LikesScreen() {
  const { colors, ui } = useTheme();
  const likes = useQuery({ queryKey: ['likes'], queryFn: () => api<LikesReceivedDto>('/likes') });
  const { refetch } = likes;
  const data = likes.data;

  const loadError = likes.isError ? errorMessage(likes.error) : null;

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  useEffect(() => {
    if (loadError) showAlert(loadError, 'Yüklenemedi');
  }, [loadError]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBottom }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 }}>
        <Text style={ui.title}>Beğeniler</Text>
        {likes.isLoading ? <Text style={ui.subtitle}>Beğenilerin geliyor.</Text> : null}
        {data?.locked ? (
          <View style={[ui.card, { padding: 24, alignItems: 'center', gap: 12 }]}>
            <View style={ui.pageIcon}>
              <Ionicons name="heart" size={26} color={colors.onAccent} />
            </View>
            <Text style={[ui.title, { fontSize: 40 }]}>{data.total}</Text>
            <Text style={[ui.subtitle, ui.centered]}>
              {data.total === 0
                ? 'Henüz beğeni yok. Keşfette kaydırmaya devam et.'
                : 'kişi seni beğendi. Kim olduklarını Plus ile gör.'}
            </Text>
            <Link href="/subscription" asChild>
              <Pressable accessibilityRole="button" style={ui.primary}>
                <Text style={ui.primaryText}>Paketlere bak</Text>
              </Pressable>
            </Link>
          </View>
        ) : null}
        {data && !data.locked && data.items.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 12, paddingTop: 48 }}>
            <View style={ui.pageIcon}>
              <Ionicons name="heart-outline" size={26} color={colors.onAccent} />
            </View>
            <Text style={[ui.subtitle, ui.centered]}>İlk beğeni yolda. Kaydırmaya devam et.</Text>
          </View>
        ) : null}
        {data && !data.locked && data.items.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {data.items.map((item) => {
              const photo = item.photos[0];
              return (
                <View key={item.id} style={[ui.card, { width: '47%', aspectRatio: 0.72 }]}>
                  {photo ? (
                    <Image
                      source={{ uri: deviceUrl(photo.urls.medium) }}
                      style={{ width: '100%', height: '100%' }}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person" size={28} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={ui.overlay}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
                      {item.firstName}
                      {item.age != null ? `, ${item.age}` : ''}
                    </Text>
                    {item.distanceKm != null ? <Text style={ui.hint}>{item.distanceKm} km uzakta</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

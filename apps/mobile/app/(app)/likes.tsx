import type { LikesReceivedDto } from '@dating/types';
import { api } from '@/api';
import { colors, ui } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LikesScreen() {
  const likes = useQuery({ queryKey: ['likes'], queryFn: () => api<LikesReceivedDto>('/likes') });
  const data = likes.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBottom }}>
      <View style={ui.screen}>
        <Text style={ui.title}>Beğeniler</Text>
        {likes.isLoading ? <Text style={ui.subtitle}>Yükleniyor…</Text> : null}
        {data?.locked ? (
          <>
            <Text style={ui.subtitle}>{data.total} kişi seni beğendi. Görmek için Plus veya Premium gerekir.</Text>
            <Link href="/subscription" style={{ color: colors.primary }}>
              Paketlere bak
            </Link>
          </>
        ) : null}
        {data && !data.locked && data.items.length === 0 ? <Text style={ui.subtitle}>Henüz beğeni yok.</Text> : null}
        {data?.items.map((item) => (
          <View key={item.id} style={[ui.card, { padding: 16 }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
              {item.firstName}, {item.age}
            </Text>
            <Text style={ui.subtitle}>{item.city ?? `${item.distanceKm} km`}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

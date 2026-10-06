import type { MatchListDto } from '@dating/types';
import { api } from '@/api';
import { colors, ui } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MatchesScreen() {
  const matches = useQuery({ queryKey: ['matches'], queryFn: () => api<MatchListDto>('/matches') });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBottom }}>
      <View style={ui.screen}>
        <Text style={ui.title}>Eşleşmeler</Text>
        {matches.isLoading ? <Text style={ui.subtitle}>Yükleniyor…</Text> : null}
        {matches.data?.matches.length === 0 ? <Text style={ui.subtitle}>Henüz eşleşme yok. Keşfetmeye devam et.</Text> : null}
        {matches.data?.matches.map((match) => (
          <Link key={match.id} href={`/chat/${match.id}`} style={[ui.card, { padding: 16 }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{match.user.firstName}</Text>
            <Text style={ui.subtitle}>
              {match.lastMessage?.preview ?? 'Sohbeti başlat'}
              {match.unreadCount > 0 ? ` · ${match.unreadCount} yeni` : ''}
            </Text>
          </Link>
        ))}
      </View>
    </SafeAreaView>
  );
}

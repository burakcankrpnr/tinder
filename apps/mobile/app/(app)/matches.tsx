import type { MatchListDto } from '@dating/types';
import { Ionicons } from '@expo/vector-icons';
import { api, deviceUrl, errorMessage } from '@/api';
import { ErrorText } from '@/ui';
import { useTheme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MatchesScreen() {
  const { colors, ui } = useTheme();
  const matches = useQuery({ queryKey: ['matches'], queryFn: () => api<MatchListDto>('/matches') });
  const { refetch } = matches;

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBottom }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 }}>
        <Text style={ui.title}>Eşleşmeler</Text>
        <ErrorText>{matches.error ? errorMessage(matches.error) : null}</ErrorText>
        {matches.isLoading ? <Text style={ui.subtitle}>Yükleniyor.</Text> : null}
        {matches.data?.matches.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 12, paddingTop: 48 }}>
            <View style={ui.pageIcon}>
              <Ionicons name="chatbubbles" size={26} color={colors.onAccent} />
            </View>
            <Text style={[ui.subtitle, ui.centered]}>
              Henüz eşleşme yok. Keşfette beğendiğiniz kişi de sizi beğenirse burada görünür.
            </Text>
          </View>
        ) : null}
        {matches.data?.matches.map((match) => (
          <Link key={match.id} href={`/chat/${match.id}`} asChild>
            <Pressable accessibilityRole="button" style={ui.listRow}>
              {match.user.photo ? (
                <Image
                  source={{ uri: deviceUrl(match.user.photo.medium) }}
                  style={ui.avatar}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={ui.avatar}>
                  <Ionicons name="person" size={24} color={colors.textMuted} />
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{match.user.firstName}</Text>
                <Text style={ui.hint} numberOfLines={1}>
                  {match.lastMessage?.preview ?? 'Sohbeti başlat'}
                  {match.unreadCount > 0 ? ` · ${match.unreadCount} yeni` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

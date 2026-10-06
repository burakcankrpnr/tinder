import type { ChatMessageDto, MessagePageDto } from '@dating/types';
import { api, errorMessage } from '@/api';
import { colors, ui } from '@/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const id = typeof matchId === 'string' ? matchId : '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => api<MessagePageDto>(`/matches/${id}/messages`),
    enabled: id.length > 0,
  });

  async function send() {
    const text = body.trim();
    if (!text) return;
    setError(null);
    setBody('');
    try {
      await api<ChatMessageDto>(`/matches/${id}/messages`, {
        method: 'POST',
        body: { type: 'TEXT', clientMessageId: Crypto.randomUUID(), body: text },
      });
      await api(`/matches/${id}/read`, { method: 'POST', body: {} });
      await queryClient.invalidateQueries({ queryKey: ['messages', id] });
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBottom }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: colors.primarySoft }}>Geri</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Sohbet</Text>
      </View>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <FlatList
        data={[...(messages.data?.messages ?? [])].reverse()}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => (
          <View style={{ alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: 16, padding: 12, maxWidth: '80%' }}>
            <Text style={{ color: colors.text }}>{item.deleted ? 'Mesaj silindi' : item.body}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={[ui.subtitle, { padding: 16 }]}>Henüz mesaj yok.</Text>}
      />
      <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Mesaj yaz"
          placeholderTextColor={colors.textMuted}
          style={[ui.input, { flex: 1 }]}
          accessibilityLabel="Mesaj"
        />
        <Pressable accessibilityRole="button" onPress={() => void send()} style={ui.primary}>
          <Text style={ui.primaryText}>Gönder</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

import type { MyProfileDto } from '@dating/types';
import { Ionicons } from '@expo/vector-icons';
import { api, deviceUrl, errorMessage } from '@/api';
import { ErrorText } from '@/ui';
import { useTheme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function MenuRow({ href, icon, label }: { href: '/settings' | '/subscription'; icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { colors, ui } = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="button" style={ui.listRow}>
        <Ionicons name={icon} size={22} color={colors.primary} />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 }}>{label}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>
    </Link>
  );
}

export default function ProfileScreen() {
  const { colors, ui } = useTheme();
  const me = useQuery({ queryKey: ['profile', 'me'], queryFn: () => api<MyProfileDto>('/profile/me') });
  const { refetch } = me;
  const profile = me.data?.profile;
  const photo = me.data?.photos.find((item) => item.urls)?.urls?.medium;

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBottom }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 }}>
        <Text style={ui.title}>Profil</Text>
        <ErrorText>{me.error ? errorMessage(me.error) : null}</ErrorText>
        <View style={[ui.card, { aspectRatio: 1 }]}>
          {photo ? (
            <Image source={{ uri: deviceUrl(photo) }} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="image" size={36} color={colors.textMuted} />
              <Text style={[ui.subtitle, ui.centered]}>Profil fotoğrafı yok.</Text>
            </View>
          )}
          {profile ? (
            <View style={ui.overlay}>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>
                {profile.firstName}
                {me.data ? `, ${me.data.age}` : ''}
              </Text>
              <Text style={ui.subtitle}>@{profile.username}</Text>
            </View>
          ) : null}
        </View>
        {me.data ? (
          <View style={{ gap: 8 }}>
            <Text style={ui.subtitle}>Profiliniz %{me.data.completeness} dolu</Text>
            <View style={ui.meter}>
              <View style={[ui.meterFill, { width: `${me.data.completeness}%` }]} />
            </View>
          </View>
        ) : null}
        {profile?.bio ? <Text style={{ color: colors.text, fontSize: 16, lineHeight: 22 }}>{profile.bio}</Text> : null}
        {me.data && me.data.interests.length > 0 ? (
          <View style={ui.row}>
            {me.data.interests.map((item) => (
              <View key={item.id} style={ui.chip}>
                <Text style={ui.chipText}>{item.name}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <MenuRow href="/settings" icon="settings" label="Ayarlar" />
        <MenuRow href="/subscription" icon="diamond" label="Abonelik" />
      </ScrollView>
    </SafeAreaView>
  );
}

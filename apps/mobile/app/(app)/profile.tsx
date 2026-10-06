import type { MyProfileDto } from '@dating/types';
import { api, deviceUrl } from '@/api';
import { colors, ui } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const me = useQuery({ queryKey: ['profile', 'me'], queryFn: () => api<MyProfileDto>('/profile/me') });
  const profile = me.data?.profile;
  const photo = me.data?.photos.find((item) => item.urls)?.urls?.medium;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBottom }}>
      <View style={ui.screen}>
        <Text style={ui.title}>{profile?.firstName ?? 'Profil'}</Text>
        {photo ? <Image source={{ uri: deviceUrl(photo) }} style={{ width: 120, height: 120, borderRadius: 24 }} accessibilityIgnoresInvertColors /> : null}
        <Text style={ui.subtitle}>@{profile?.username}</Text>
        {profile?.bio ? <Text style={{ color: colors.text }}>{profile.bio}</Text> : null}
        <Link href="/settings" style={{ color: colors.primarySoft }}>
          Ayarlar
        </Link>
        <Link href="/subscription" style={{ color: colors.primarySoft }}>
          Abonelik
        </Link>
      </View>
    </SafeAreaView>
  );
}

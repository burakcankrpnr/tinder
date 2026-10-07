import type { MyProfileDto } from '@dating/types';
import { Ionicons } from '@expo/vector-icons';
import { api, deviceUrl, errorMessage } from '@/api';
import { showAlert } from '@/ui';
import { useTheme } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FRIEND_LIMIT = 3;

function explain() {
  showAlert(
    'En fazla 3 arkadaşınla çift olabilirsin. Birlikte kaydırır, diğer Çifte Randevu çiftleriyle eşleşirsiniz.',
    'Çifte Randevu',
  );
}

export default function DoubleDateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const me = useQuery({ queryKey: ['profile', 'me'], queryFn: () => api<MyProfileDto>('/profile/me') });
  const profile = me.data?.profile;
  const photo = (me.data?.photos ?? []).find((item) => item.urls);
  const name = profile?.firstName ?? 'Sen';

  async function invite() {
    try {
      await Share.share({
        message: `${name} seni Çifte Randevu'ya davet ediyor. Birlikte diğer çiftlerle eşleşmek için uygulamayı aç.`,
      });
    } catch (caught) {
      showAlert(errorMessage(caught), 'Davet gönderilemedi');
    }
  }

  function addActivity() {
    showAlert(
      'Diğer Çifte Randevu çiftleriyle eşleşmek için ortak bir buluşma etkinliği ekleyebilirsin.',
      'Buluşma Etkinliği',
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBottom }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
        <RoundIcon icon="close" label="Kapat" onPress={() => router.back()} />
        <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 18, fontWeight: '800' }}>Çifte Randevu</Text>
        <RoundIcon icon="settings-outline" label="Çifte Randevu bilgisi" onPress={explain} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Çifte Randevu arkadaşları</Text>
          <Text style={{ color: colors.textMuted, fontSize: 15 }}>1/{FRIEND_LIMIT}</Text>
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 16, gap: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: colors.surface2 }}>
              {photo?.urls ? (
                <Image source={{ uri: deviceUrl(photo.urls.medium) }} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={28} color={colors.textMuted} />
                </View>
              )}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                onPress={addActivity}
                style={{ alignSelf: 'flex-start', backgroundColor: colors.surface2, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>+ Buluşma Etkinliği Ekle</Text>
              </Pressable>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{name}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Seçenekler" hitSlop={8} onPress={explain}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person" size={26} color={colors.textMuted} />
            </View>
            <Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' }}>Arkadaşını davet et</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Arkadaş ekle"
              onPress={() => void invite()}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="add" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
          Çifte Randevu'da en fazla {FRIEND_LIMIT} arkadaşınla çift olabilirsin.{' '}
          <Text style={{ color: colors.primary }} onPress={explain}>
            Daha fazla bilgi edin
          </Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={addActivity}
          style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}
        >
          <Text style={{ fontSize: 36 }} accessibilityLabel="Kiraz">
            🍒
          </Text>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Buluşma Etkinliği Ekle</Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
              Diğer Çifte Randevu çiftleriyle eşleş ve hepinizin seveceği etkinliklerin keyfini çıkar.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void invite()}
          style={{ backgroundColor: colors.text, borderRadius: 999, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ color: colors.bgBottom, fontSize: 17, fontWeight: '800' }}>Arkadaşlarını Davet Et</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function RoundIcon({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

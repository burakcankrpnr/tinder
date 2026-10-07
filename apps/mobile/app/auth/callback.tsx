import { useSession } from '@/session';
import { Screen, Subtitle, Title, showAlert } from '@/ui';
import { useTheme } from '@/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ refreshToken?: string; error?: string }>();
  const { adopt } = useSession();
  const router = useRouter();
  const token = typeof params.refreshToken === 'string' ? params.refreshToken : '';
  const oauthError = typeof params.error === 'string' ? params.error : '';

  useEffect(() => {
    if (oauthError) {
      showAlert(
        oauthError === 'oauth_account_not_found'
          ? 'Bu Google hesabı kayıtlı bir kullanıcıya bağlı değil. Önce kayıt ol.'
          : 'Google ile giriş tamamlanamadı.',
        'Giriş olmadı',
      );
    }
    if (!token) return;
    void adopt(token)
      .then(() => router.replace('/'))
      .catch(() => router.replace('/login'));
  }, [adopt, oauthError, router, token]);

  return (
    <Screen>
      <Title>Giriş</Title>
      {token ? <ActivityIndicator color={colors.primary} /> : null}
      {!token && !oauthError ? <Subtitle>Oturum bekleniyor.</Subtitle> : null}
    </Screen>
  );
}

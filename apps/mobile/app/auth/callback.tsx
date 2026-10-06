import { useSession } from '@/session';
import { ErrorText, Screen, Subtitle, Title } from '@/ui';
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
    if (!token) return;
    void adopt(token)
      .then(() => router.replace('/'))
      .catch(() => router.replace('/login'));
  }, [adopt, router, token]);

  return (
    <Screen>
      <Title>Giriş</Title>
      {token ? <ActivityIndicator color={colors.primary} /> : null}
      <ErrorText>
        {oauthError === 'oauth_account_not_found'
          ? 'Bu Google hesabı kayıtlı bir kullanıcıya bağlı değil. Önce kayıt ol.'
          : oauthError
            ? 'Google ile giriş tamamlanamadı.'
            : null}
      </ErrorText>
      {!token && !oauthError ? <Subtitle>Oturum bekleniyor.</Subtitle> : null}
    </Screen>
  );
}

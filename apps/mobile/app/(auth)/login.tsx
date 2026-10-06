import { loginSchema } from '@dating/validation';
import { ApiError, errorMessage, googleStartUrl } from '@/api';
import { useSession } from '@/session';
import { ErrorText, Field, GoogleButton, Notice, OrDivider, PageHeading, PrimaryButton, Screen } from '@/ui';
import * as WebBrowser from 'expo-web-browser';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { colors } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { login, adopt } = useSession();
  const verified = useLocalSearchParams<{ verified?: string }>().verified === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Formu kontrol et.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(parsed.data);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'EMAIL_NOT_VERIFIED') {
        setError('E-postan henüz doğrulanmadı. Gelen kutundaki bağlantıya dokun, sonra tekrar giriş yap.');
      } else {
        setError(errorMessage(caught));
      }
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    const result = await WebBrowser.openAuthSessionAsync(googleStartUrl(), 'dating://auth/callback');
    if (result.type !== 'success') return;
    const url = new URL(result.url);
    const token = url.searchParams.get('refreshToken');
    const oauthError = url.searchParams.get('error');
    if (!token) {
      setError(oauthError === 'oauth_account_not_found' ? 'Önce uygulamadan kayıt ol.' : 'Google ile giriş tamamlanamadı.');
      return;
    }
    setBusy(true);
    try {
      await adopt(token);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeading
        icon="log-in"
        title="Giriş yapın"
        subtitle="Kayıt olduğunuz e-posta ve şifre ile devam edin."
      />
      <Notice tone="success">
        {verified ? 'E-postan doğrulandı. Şimdi aynı e-posta ve şifreyle gir.' : null}
      </Notice>
      <ErrorText>{error}</ErrorText>
      <Field label="E-posta" icon="mail" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Field
        label="Şifre"
        icon="lock-closed"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      <Link href="/forgot-password" style={{ color: colors.primarySoft, fontSize: 15 }}>
        Şifremi unuttum
      </Link>
      <PrimaryButton label="Giriş yap" onPress={() => void onSubmit()} loading={busy} />
      <OrDivider />
      <GoogleButton label="Google ile devam et" onPress={() => void onGoogle()} disabled={busy} />
      <Link href="/register" style={{ color: colors.text, textAlign: 'center', fontSize: 15 }}>
        Hesabın yok mu? Kayıt ol
      </Link>
    </Screen>
  );
}

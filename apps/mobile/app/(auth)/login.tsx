import { loginSchema } from '@dating/validation';
import { ApiError, errorMessage, googleStartUrl } from '@/api';
import { readSavedEmail, rememberEmail } from '@/saved-email';
import { useSession } from '@/session';
import { Field, GoogleButton, OrDivider, PageHeading, PrimaryButton, Screen, flagMissing, showAlert } from '@/ui';
import * as WebBrowser from 'expo-web-browser';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login, adopt } = useSession();
  const verified = useLocalSearchParams<{ verified?: string }>().verified === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const verifiedShown = useRef(false);

  useEffect(() => {
    if (!verified || verifiedShown.current) return;
    verifiedShown.current = true;
    showAlert('E-postan doğrulandı. Şimdi aynı e-posta ve şifreyle gir.', 'E-posta doğrulandı', 'success');
  }, [verified]);

  useEffect(() => {
    void readSavedEmail().then((saved) => {
      if (saved) setEmail((current) => current || saved);
    });
  }, []);

  async function onSubmit() {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      flagMissing(
        !email.trim() ? 'E-posta boş bırakılamaz.' : !password ? 'Şifre boş bırakılamaz.' : (parsed.error.issues[0]?.message ?? 'Formu kontrol et.'),
      );
      return;
    }
    void rememberEmail(parsed.data.email);
    setBusy(true);
    try {
      await login(parsed.data);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'EMAIL_NOT_VERIFIED') {
        showAlert('E-postan henüz doğrulanmadı. Gelen kutundaki bağlantıya dokun, sonra tekrar giriş yap.', 'E-posta doğrulanmadı');
      } else {
        showAlert(errorMessage(caught), 'Giriş yapılamadı');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    const result = await WebBrowser.openAuthSessionAsync(googleStartUrl(), 'dating://auth/callback');
    if (result.type !== 'success') return;
    const url = new URL(result.url);
    const token = url.searchParams.get('refreshToken');
    const oauthError = url.searchParams.get('error');
    if (!token) {
      showAlert(
        oauthError === 'oauth_account_not_found' ? 'Önce uygulamadan kayıt ol.' : 'Google ile giriş tamamlanamadı.',
        'Giriş yapılamadı',
      );
      return;
    }
    setBusy(true);
    try {
      await adopt(token);
    } catch (caught) {
      showAlert(errorMessage(caught), 'Giriş yapılamadı');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeading
        icon="log-in"
        title="Giriş yapın"
        subtitle="E-posta ve şifrenle gir."
      />
      <Field
        label="E-posta"
        icon="mail"
        autoCapitalize="none"
        autoComplete="username"
        keyboardType="email-address"
        inputMode="email"
        textContentType="username"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Şifre"
        icon="lock-closed"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
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

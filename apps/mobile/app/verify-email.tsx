import { verifyEmailSchema } from '@dating/validation';
import { api, errorMessage } from '@/api';
import { ErrorText, PrimaryButton, Screen, Subtitle, Title } from '@/ui';
import { useTheme } from '@/theme';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const [error, setError] = useState<string | null>(token ? null : 'Bağlantı geçersiz.');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void onSubmit();
  }, [token]);

  async function onSubmit() {
    const parsed = verifyEmailSchema.safeParse({ token });
    if (!parsed.success) {
      setError('Bağlantı geçersiz.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/auth/verify-email', { method: 'POST', auth: false, body: parsed.data });
      setDone(true);
      router.replace({ pathname: '/login', params: { verified: '1' } });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Emailini doğrula</Title>
      <Subtitle>
        {done
          ? 'E-postan doğrulandı. Giriş ekranına geç. Şifreni orada yazman gerekir; maildeki düğme seni içeri almaz.'
          : 'Bu adım yalnız e-postanın sana ait olduğunu onaylar. Ardından şifrenle giriş yaparsın.'}
      </Subtitle>
      <ErrorText>{error}</ErrorText>
      {done ? null : <PrimaryButton label="Doğrula" onPress={() => void onSubmit()} loading={busy} />}
      <Link href="/login" style={{ color: colors.primarySoft }}>
        Girişe dön
      </Link>
    </Screen>
  );
}

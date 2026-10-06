import type { AuthResultDto, MessageDto } from '@dating/types';
import { registerSchema } from '@dating/validation';
import { api, errorMessage, saveSession } from '@/api';
import { ErrorText, Field, Notice, PageHeading, PrimaryButton, Screen, flagMissing } from '@/ui';
import { useTheme } from '@/theme';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';

function isSession(value: AuthResultDto | MessageDto): value is AuthResultDto {
  return 'accessToken' in value && typeof value.refreshToken === 'string';
}

export default function RegisterScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    const parsed = registerSchema.safeParse({ email, password, birthDate });
    if (!parsed.success) {
      const message = !email.trim()
        ? 'E-posta boş bırakılamaz.'
        : !password
          ? 'Şifre boş bırakılamaz.'
          : !birthDate.trim()
            ? 'Doğum tarihi boş bırakılamaz.'
            : (parsed.error.issues[0]?.message ?? 'Formu kontrol et.');
      flagMissing(setError, message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<AuthResultDto | MessageDto>('/auth/register', {
        method: 'POST',
        auth: false,
        body: { email: parsed.data.email, password, birthDate },
      });
      if (isSession(result)) {
        await saveSession(result);
        router.replace('/');
        return;
      }
      setInfo('Hesabın açıldı. Doğrulama bağlantısını e-postana gönderdik. Gelen kutuna bak, spam klasörünü de kontrol et.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeading icon="person-add" title="Hesap oluşturun" />
      <ErrorText>{error}</ErrorText>
      <Notice tone="success">{info}</Notice>
      <Field
        label="E-posta"
        icon="mail"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        hint="Doğrulama bağlantısı bu adrese gönderilir."
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Şifre"
        icon="lock-closed"
        secureTextEntry
        autoComplete="new-password"
        hint="En az 10 karakter olmalıdır. En az bir harf ve bir rakam içermelidir."
        value={password}
        onChangeText={setPassword}
      />
      <Field
        label="Doğum tarihi"
        icon="calendar"
        placeholder="2000-01-15"
        hint="Yıl-ay-gün biçiminde yazın. Örnek: 2000-01-15"
        value={birthDate}
        onChangeText={setBirthDate}
      />
      <PrimaryButton label="Kayıt ol" onPress={() => void onSubmit()} loading={busy} />
      <Link href="/login" style={{ color: colors.primarySoft, textAlign: 'center', fontSize: 15 }}>
        Zaten hesabın var mı? Giriş yap
      </Link>
    </Screen>
  );
}

import type { AuthResultDto, MessageDto } from '@dating/types';
import { registerSchema } from '@dating/validation';
import { api, errorMessage, saveSession } from '@/api';
import { BirthDateField } from '@/birth-date-field';
import { readSavedEmail, rememberEmail } from '@/saved-email';
import { Field, PageHeading, PrimaryButton, Screen, flagMissing, showAlert } from '@/ui';
import { useTheme } from '@/theme';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

function isSession(value: AuthResultDto | MessageDto): value is AuthResultDto {
  return 'accessToken' in value && typeof value.refreshToken === 'string';
}

export default function RegisterScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readSavedEmail().then((saved) => {
      if (saved) setEmail((current) => current || saved);
    });
  }, []);

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
      flagMissing(message);
      return;
    }
    void rememberEmail(parsed.data.email);
    setBusy(true);
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
      showAlert(
        'Doğrulama bağlantısını e-postana gönderdik. Gelen kutuna bak, spam klasörünü de kontrol et.',
        'Hesabın açıldı',
        'success',
      );
    } catch (caught) {
      showAlert(errorMessage(caught), 'Kayıt olmadı');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeading icon="person-add" title="Hesap oluşturun" />
      <Field
        label="E-posta"
        icon="mail"
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
        autoComplete="username"
        textContentType="username"
        hint="Doğrulama bağlantısı bu adrese gönderilir."
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Şifre"
        icon="lock-closed"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint="En az 10 karakter olmalıdır. En az bir harf ve bir rakam içermelidir."
        value={password}
        onChangeText={setPassword}
      />
      <BirthDateField value={birthDate} onChange={setBirthDate} />
      <PrimaryButton label="Kayıt ol" onPress={() => void onSubmit()} loading={busy} />
      <Link href="/login" style={{ color: colors.primarySoft, textAlign: 'center', fontSize: 15 }}>
        Zaten hesabın var mı? Giriş yap
      </Link>
    </Screen>
  );
}

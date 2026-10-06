import { registerSchema } from '@dating/validation';
import { api, errorMessage } from '@/api';
import { ErrorText, Field, Notice, PageHeading, PrimaryButton, Screen } from '@/ui';
import { colors } from '@/theme';
import { Link } from 'expo-router';
import { useState } from 'react';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    const parsed = registerSchema.safeParse({ email, password, birthDate });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Formu kontrol et.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/auth/register', {
        method: 'POST',
        auth: false,
        body: { email: parsed.data.email, password, birthDate },
      });
      setInfo('Hesabın açıldı. Doğrulama bağlantısını e-postana gönderdik. Gelen kutuna bak, spam klasörünü de kontrol et.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeading
        icon="person-add"
        title="Hesap oluşturun"
        subtitle="E-posta adresiniz, şifreniz ve doğum tarihiniz ile hesabınızı açın. Kayıt sonrasında e-postanıza bir doğrulama bağlantısı gönderilir. Platformu kullanmak için 18 yaşından büyük olmalısınız."
      />
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

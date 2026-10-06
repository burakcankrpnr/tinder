import { emailOnlySchema } from '@dating/validation';
import { api, errorMessage } from '@/api';
import { ErrorText, Field, Notice, PageHeading, PrimaryButton, Screen, flagMissing } from '@/ui';
import { useTheme } from '@/theme';
import { Link } from 'expo-router';
import { useState } from 'react';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    const parsed = emailOnlySchema.safeParse({ email });
    if (!parsed.success) {
      flagMissing(setError, !email.trim() ? 'E-posta boş bırakılamaz.' : (parsed.error.issues[0]?.message ?? 'E-posta gerekli.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', auth: false, body: parsed.data });
      setInfo('Bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi. Gelen kutunu ve spam klasörünü kontrol et.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeading
        icon="key"
        title="Şifrenizi yenileyin"
        subtitle="Kayıtlı e-posta adresinizi yazın. Size yeni şifre belirlemeniz için bir bağlantı gönderilir."
      />
      <ErrorText>{error}</ErrorText>
      <Notice tone="success">{info}</Notice>
      <Field
        label="E-posta"
        icon="mail"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        hint="Hesabınız bu adresle açıldıysa bağlantı buraya gelir."
        value={email}
        onChangeText={setEmail}
      />
      <PrimaryButton label="Bağlantı gönder" onPress={() => void onSubmit()} loading={busy} />
      <Link href="/login" style={{ color: colors.primarySoft }}>
        Girişe dön
      </Link>
    </Screen>
  );
}

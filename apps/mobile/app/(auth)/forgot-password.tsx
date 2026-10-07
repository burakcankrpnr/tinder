import { emailOnlySchema } from '@dating/validation';
import { api, errorMessage } from '@/api';
import { readSavedEmail, rememberEmail } from '@/saved-email';
import { Field, PageHeading, PrimaryButton, Screen, flagMissing, showAlert } from '@/ui';
import { useTheme } from '@/theme';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readSavedEmail().then((saved) => {
      if (saved) setEmail((current) => current || saved);
    });
  }, []);

  async function onSubmit() {
    const parsed = emailOnlySchema.safeParse({ email });
    if (!parsed.success) {
      flagMissing(!email.trim() ? 'E-posta boş bırakılamaz.' : (parsed.error.issues[0]?.message ?? 'E-posta gerekli.'));
      return;
    }
    void rememberEmail(parsed.data.email);
    setBusy(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', auth: false, body: parsed.data });
      showAlert(
        'Bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi. Gelen kutunu ve spam klasörünü kontrol et.',
        'Bağlantı gönderildi',
        'success',
      );
    } catch (caught) {
      showAlert(errorMessage(caught), 'Gönderilemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeading
        icon="key"
        title="Şifrenizi yenileyin"
        subtitle="E-postana sıfırlama bağlantısı gelir."
      />
      <Field
        label="E-posta"
        icon="mail"
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
        autoComplete="email"
        textContentType="emailAddress"
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

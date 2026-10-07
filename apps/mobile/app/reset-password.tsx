import { resetPasswordSchema } from '@dating/validation';
import { api, errorMessage } from '@/api';
import { Field, PrimaryButton, Screen, Subtitle, Title, flagMissing, showAlert } from '@/ui';
import { useTheme } from '@/theme';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      flagMissing(
        !token ? 'Bağlantı geçersiz.' : !password ? 'Şifre boş bırakılamaz.' : (parsed.error.issues[0]?.message ?? 'Şifreyi kontrol et.'),
      );
      return;
    }
    setBusy(true);
    try {
      await api('/auth/reset-password', { method: 'POST', auth: false, body: { token, password } });
      setDone(true);
    } catch (caught) {
      showAlert(errorMessage(caught), 'Şifre güncellenemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Yeni şifre</Title>
      <Subtitle>{done ? 'Şifren güncellendi.' : 'En az 10 karakter, bir harf ve bir rakam.'}</Subtitle>
      {done ? null : (
        <>
          <Field
            label="Yeni şifre"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
          />
          <PrimaryButton label="Kaydet" onPress={() => void onSubmit()} loading={busy} />
        </>
      )}
      <Link href="/login" style={{ color: colors.primarySoft }}>
        Girişe dön
      </Link>
    </Screen>
  );
}

import { DELETE_ACCOUNT_CONFIRMATION, deleteAccountSchema } from '@dating/validation';
import { api, errorMessage } from '@/api';
import { useSession } from '@/session';
import { ErrorText, Field, PrimaryButton, Screen, SecondaryButton, Subtitle, Title, flagMissing } from '@/ui';
import { useState } from 'react';

export default function SettingsScreen() {
  const { logout } = useSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const parsed = deleteAccountSchema.safeParse({ password, confirmation });
    if (!parsed.success) {
      flagMissing(
        setError,
        !password
          ? 'Şifre boş bırakılamaz.'
          : !confirmation.trim()
            ? 'Onay boş bırakılamaz.'
            : (parsed.error.issues[0]?.message ?? 'Onayı kontrol et.'),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/users/me/delete', { method: 'POST', body: parsed.data });
      await logout();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Ayarlar</Title>
      <Subtitle>Hesabını silmek kalıcıdır. Onay için {DELETE_ACCOUNT_CONFIRMATION} yaz.</Subtitle>
      <SecondaryButton label="Çıkış yap" onPress={() => void logout()} />
      <ErrorText>{error}</ErrorText>
      <Field label="Şifre" secureTextEntry value={password} onChangeText={setPassword} />
      <Field label="Onay" autoCapitalize="characters" value={confirmation} onChangeText={setConfirmation} />
      <PrimaryButton label="Hesabı sil" onPress={() => void onDelete()} loading={busy} />
    </Screen>
  );
}

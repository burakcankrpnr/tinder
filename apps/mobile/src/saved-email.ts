import * as SecureStore from 'expo-secure-store';

const KEY = 'saved-login-email';

export async function rememberEmail(email: string): Promise<void> {
  const value = email.trim().toLowerCase();
  if (!value.includes('@')) return;
  try {
    await SecureStore.setItemAsync(KEY, value);
  } catch {
    return;
  }
}

export async function readSavedEmail(): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(KEY)) ?? '';
  } catch {
    return '';
  }
}

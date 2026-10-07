import { Ionicons } from '@expo/vector-icons';
import { useSyncExternalStore } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTheme } from './theme';

export type AlertTone = 'info' | 'success' | 'danger';

interface AlertRequest {
  id: number;
  title: string;
  message: string;
  tone: AlertTone;
}

let current: AlertRequest | null = null;
let nextId = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function showAlert(message: string, title = 'Eksik bilgi', tone: AlertTone = 'danger'): void {
  nextId += 1;
  current = { id: nextId, title, message, tone };
  emit();
}

export function flagMissing(message: string): void {
  showAlert(message, 'Eksik bilgi', 'info');
}

function dismiss(): void {
  current = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function AppAlertHost() {
  const alert = useSyncExternalStore(subscribe, () => current, () => null);
  const { colors } = useTheme();
  if (!alert) return null;
  const icon =
    alert.tone === 'success' ? 'checkmark-circle' : alert.tone === 'info' ? 'information-circle' : 'alert-circle';
  const iconColor = alert.tone === 'success' ? colors.success : alert.tone === 'info' ? colors.primary : colors.danger;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          onPress={dismiss}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.photoScrim, opacity: 0.45 }}
        />
        <View
          accessibilityRole="alert"
          style={{
            alignSelf: 'center',
            width: '100%',
            maxWidth: 340,
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.surface2,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 8,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={icon} size={20} color={iconColor} />
            <Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' }}>{alert.title}</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>{alert.message}</Text>
          <Pressable accessibilityRole="button" onPress={dismiss} style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 }}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>Tamam</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

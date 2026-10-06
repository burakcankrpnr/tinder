import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.bgBottom },
        headerTintColor: colors.text,
        title: 'Profili düzenle',
      }}
    />
  );
}

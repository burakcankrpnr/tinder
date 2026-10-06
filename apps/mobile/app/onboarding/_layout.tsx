import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function OnboardingLayout() {
  const { colors } = useTheme();
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

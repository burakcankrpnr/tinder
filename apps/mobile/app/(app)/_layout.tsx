import { darkColors, useTheme } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

function tabIcon(active: keyof typeof Ionicons.glyphMap, idle: keyof typeof Ionicons.glyphMap) {
  return ({ color, focused }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : idle} size={24} color={typeof color === 'string' ? color : darkColors.primary} />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surface2,
          paddingTop: 4,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="discover" options={{ title: 'Keşfet', tabBarIcon: tabIcon('compass', 'compass-outline') }} />
      <Tabs.Screen name="likes" options={{ title: 'Beğeniler', tabBarIcon: tabIcon('heart', 'heart-outline') }} />
      <Tabs.Screen name="matches" options={{ title: 'Eşleşmeler', tabBarIcon: tabIcon('chatbubbles', 'chatbubbles-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: tabIcon('person', 'person-outline') }} />
    </Tabs>
  );
}

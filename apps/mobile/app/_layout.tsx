import { colors } from '@/theme';
import { useSession } from '@/session';
import { refreshStoredLocation } from '@/place';
import { BrandSplash } from '@/ui';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '@/session';

function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'authenticated') return;
    void refreshStoredLocation();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshStoredLocation();
    });
    return () => sub.remove();
  }, [status]);

  useEffect(() => {
    if (status === 'loading') return;
    const top = segments[0];
    const isPublic = top === '(auth)' || top === 'verify-email' || top === 'reset-password' || top === 'auth';
    if (status === 'anonymous' && !isPublic) router.replace('/login');
    if (status === 'authenticated' && top === '(auth)') router.replace('/');
  }, [router, segments, status]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {status === 'loading' ? (
        <View style={StyleSheet.absoluteFill}>
          <BrandSplash />
        </View>
      ) : null}
    </View>
  );
}

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <AuthGate>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bgBottom },
              }}
            />
          </AuthGate>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

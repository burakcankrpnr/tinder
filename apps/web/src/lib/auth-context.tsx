'use client';

import type { AuthResultDto, CurrentUserDto } from '@dating/types';
import type { LoginInput } from '@dating/validation';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onSessionChange, refreshSession, setAccessToken } from './api-client';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: CurrentUserDto }
  | { status: 'anonymous'; user: null };

interface AuthContextValue {
  state: AuthState;
  login(input: LoginInput): Promise<CurrentUserDto>;
  logout(): Promise<void>;
  /** OAuth callback gibi cookie'nin dışarıda set edildiği durumlarda oturumu yükler. */
  reload(): Promise<CurrentUserDto | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toState(result: AuthResultDto | null): AuthState {
  return result ? { status: 'authenticated', user: result.user } : { status: 'anonymous', user: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  useEffect(() => {
    const unsubscribe = onSessionChange((result) => {
      setState(toState(result));
      if (!result) queryClient.clear();
    });
    void refreshSession();
    return unsubscribe;
  }, [queryClient]);

  const login = useCallback(
    async (input: LoginInput) => {
      const result = await api<AuthResultDto>('/auth/login', { method: 'POST', body: input });
      queryClient.clear();
      setAccessToken(result.accessToken);
      setState(toState(result));
      return result.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      queryClient.clear();
      setState({ status: 'anonymous', user: null });
    }
  }, [queryClient]);

  const reload = useCallback(async () => (await refreshSession())?.user ?? null, []);

  const value = useMemo(() => ({ state, login, logout, reload }), [state, login, logout, reload]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalı.');
  return context;
}

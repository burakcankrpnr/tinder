import type { AuthResultDto, CurrentUserDto } from '@dating/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { adoptRefreshToken, api, loadSession, logoutSession, onSessionChange, saveSession } from './api';

type Status = 'loading' | 'anonymous' | 'authenticated';

interface SessionValue {
  status: Status;
  user: CurrentUserDto | null;
  login(input: { email: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  adopt(refreshToken: string): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<CurrentUserDto | null>(null);

  useEffect(() => {
    const unsubscribe = onSessionChange((result) => {
      setUser(result?.user ?? null);
      setStatus(result ? 'authenticated' : 'anonymous');
    });
    void loadSession().then((result) => {
      setUser(result?.user ?? null);
      setStatus(result ? 'authenticated' : 'anonymous');
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (input: { email: string; password: string }) => {
    const result = await api<AuthResultDto>('/auth/login', { method: 'POST', body: input, auth: false });
    await saveSession(result);
  }, []);

  const adopt = useCallback(async (token: string) => {
    const result = await adoptRefreshToken(token);
    if (!result) throw new Error('Oturum açılamadı.');
  }, []);

  const logout = useCallback(async () => {
    await logoutSession();
  }, []);

  const value = useMemo(() => ({ status, user, login, logout, adopt }), [status, user, login, logout, adopt]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession, SessionProvider içinde kullanılmalı.');
  return value;
}

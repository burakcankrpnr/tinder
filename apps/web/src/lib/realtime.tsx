'use client';

import type { ClientToServerEvents, MatchDetailDto, ServerToClientEvents } from '@dating/types';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { type Socket, io } from 'socket.io-client';
import { apiBaseUrl, getAccessToken, refreshSession } from './api-client';
import { useAuth } from './auth-context';
import { commsKeys, patchMatchList, patchMessages, upsertMessage } from './communication';

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RealtimeContextValue {
  socket: RealtimeSocket | null;
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({ socket: null, connected: false });
const MAX_AUTH_RETRIES = 3;

/**
 * Oturum açıkken tek bir Socket.IO bağlantısı tutar ve gelen olaylarla React Query cache'ini günceller.
 * Token süresi dolunca sunucu bağlantıyı kapatır; burada token yenilenip yeniden bağlanılır.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<RealtimeSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const authRetries = useRef(0);
  const userId = state.status === 'authenticated' ? state.user.id : null;

  useEffect(() => {
    if (!userId) return;
    const client: RealtimeSocket = io(`${apiBaseUrl()}/realtime`, {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      auth: (callback) => callback({ token: getAccessToken() }),
    });

    const reconnectWithFreshToken = async () => {
      if (authRetries.current >= MAX_AUTH_RETRIES) return;
      authRetries.current += 1;
      const refreshed = await refreshSession();
      if (refreshed) client.connect();
    };

    client.on('connect', () => {
      authRetries.current = 0;
      setConnected(true);
      void queryClient.invalidateQueries({ queryKey: commsKeys.matches });
    });
    client.on('disconnect', (reason) => {
      setConnected(false);
      if (reason === 'io server disconnect') void reconnectWithFreshToken();
    });
    client.on('connect_error', (error) => {
      setConnected(false);
      if (error.message === 'UNAUTHORIZED') void reconnectWithFreshToken();
    });

    client.on('message:new', (message) => {
      upsertMessage(queryClient, message);
      void queryClient.invalidateQueries({ queryKey: commsKeys.matches, exact: true });
    });
    client.on('message:deleted', ({ matchId, messageId }) => {
      patchMessages(queryClient, matchId, (message) =>
        message.id === messageId ? { ...message, deleted: true, body: null, image: null } : message,
      );
      void queryClient.invalidateQueries({ queryKey: commsKeys.matches, exact: true });
    });
    client.on('message:read', ({ matchId, readerId, readAt }) => {
      patchMessages(queryClient, matchId, (message) =>
        message.senderId !== readerId && !message.readAt ? { ...message, readAt } : message,
      );
      void queryClient.invalidateQueries({ queryKey: commsKeys.matches, exact: true });
    });
    client.on('presence', ({ userId: changedUserId, online }) => {
      patchMatchList(queryClient, (match) => (match.user.id === changedUserId ? { ...match, online } : match));
      queryClient.setQueriesData<MatchDetailDto>(
        { predicate: (query) => query.queryKey[0] === commsKeys.matches[0] && query.queryKey.length === 2 },
        (detail) => (detail && detail.user.id === changedUserId ? { ...detail, online } : detail),
      );
    });
    client.on('match:new', () => void queryClient.invalidateQueries({ queryKey: commsKeys.matches, exact: true }));
    client.on('match:ended', ({ matchId }) => {
      queryClient.removeQueries({ queryKey: commsKeys.messages(matchId) });
      void queryClient.invalidateQueries({ queryKey: commsKeys.matches });
    });
    client.on('notification:new', () => {
      void queryClient.invalidateQueries({ queryKey: commsKeys.unread });
      void queryClient.invalidateQueries({ queryKey: commsKeys.notifications, exact: true });
    });

    setSocket(client);
    return () => {
      client.removeAllListeners();
      client.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [userId, queryClient]);

  return <RealtimeContext.Provider value={{ socket, connected }}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

/** Bileşen yaşadığı sürece belirli bir socket olayını dinler. */
export function useRealtimeEvent<E extends keyof ServerToClientEvents>(
  event: E,
  handler: ServerToClientEvents[E],
): void {
  const { socket } = useRealtime();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    if (!socket) return;
    const listener = ((...args: Parameters<ServerToClientEvents[E]>) =>
      (handlerRef.current as (...a: Parameters<ServerToClientEvents[E]>) => void)(...args)) as ServerToClientEvents[E];
    // socket.io-client'ın generic on/off imzaları olay adına göre daraltılamıyor.
    const target = socket as unknown as {
      on: (name: string, fn: (...args: unknown[]) => void) => void;
      off: (name: string, fn: (...args: unknown[]) => void) => void;
    };
    target.on(event, listener as (...args: unknown[]) => void);
    return () => target.off(event, listener as (...args: unknown[]) => void);
  }, [socket, event]);
}

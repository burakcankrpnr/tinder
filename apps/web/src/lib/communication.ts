'use client';

import type {
  BlockedUserDto,
  ChatMessageDto,
  MatchDetailDto,
  MatchListDto,
  MessagePageDto,
  NotificationPageDto,
  NotificationPreferencesDto,
  ReportCreatedDto,
} from '@dating/types';
import type { NotificationPreferencesInput, ReportInput } from '@dating/validation';
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from './api-client';

export const commsKeys = {
  matches: ['matches'] as const,
  match: (matchId: string) => ['matches', matchId] as const,
  messages: (matchId: string) => ['messages', matchId] as const,
  notifications: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  preferences: ['notifications', 'preferences'] as const,
  blocks: ['blocks'] as const,
};

export type MessagesData = InfiniteData<MessagePageDto, string | null>;

/** İstemcide bekleyen (henüz sunucu onayı almamış) mesaj. */
export interface PendingMessage {
  clientMessageId: string;
  matchId: string;
  body: string | null;
  imagePreview: string | null;
  createdAt: string;
  status: 'sending' | 'failed';
  error?: string;
}

export function useMatches() {
  return useQuery({ queryKey: commsKeys.matches, queryFn: () => api<MatchListDto>('/matches') });
}

export function useMatchDetail(matchId: string) {
  return useQuery({
    queryKey: commsKeys.match(matchId),
    queryFn: () => api<MatchDetailDto>(`/matches/${matchId}`),
  });
}

export function useMessages(matchId: string) {
  return useInfiniteQuery({
    queryKey: commsKeys.messages(matchId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api<MessagePageDto>(`/matches/${matchId}/messages${pageParam ? `?before=${pageParam}` : ''}`, { signal }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: Infinity,
  });
}

/** Sayfalar en yeniden eskiye; her sayfanın içi eskiden yeniye sıralıdır. */
export function flattenMessages(data: InfiniteData<MessagePageDto, unknown> | undefined): ChatMessageDto[] {
  if (!data) return [];
  return [...data.pages].reverse().flatMap((page) => page.messages);
}

/** Socket ve REST'ten aynı mesaj iki kez gelebilir; id veya clientMessageId ile tekilleştirilir. */
export function upsertMessage(queryClient: QueryClient, message: ChatMessageDto): void {
  queryClient.setQueryData<MessagesData>(commsKeys.messages(message.matchId), (data) => {
    if (!data) return data;
    let replaced = false;
    const pages = data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((item) => {
        if (item.id === message.id || item.clientMessageId === message.clientMessageId) {
          replaced = true;
          return message;
        }
        return item;
      }),
    }));
    if (!replaced && pages[0]) pages[0] = { ...pages[0], messages: [...pages[0].messages, message] };
    return { ...data, pages };
  });
}

export function patchMessages(
  queryClient: QueryClient,
  matchId: string,
  patch: (message: ChatMessageDto) => ChatMessageDto,
): void {
  queryClient.setQueryData<MessagesData>(commsKeys.messages(matchId), (data) =>
    data ? { ...data, pages: data.pages.map((page) => ({ ...page, messages: page.messages.map(patch) })) } : data,
  );
}

export function patchMatchList(
  queryClient: QueryClient,
  patch: (match: MatchListDto['matches'][number]) => MatchListDto['matches'][number],
): void {
  queryClient.setQueryData<MatchListDto>(commsKeys.matches, (data) =>
    data ? { matches: data.matches.map(patch) } : data,
  );
}

export function useUnmatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => api(`/matches/${matchId}`, { method: 'DELETE' }),
    onSuccess: (_data, matchId) => {
      queryClient.removeQueries({ queryKey: commsKeys.messages(matchId) });
      void queryClient.invalidateQueries({ queryKey: commsKeys.matches });
    },
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api('/blocks', { method: 'POST', body: { userId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commsKeys.matches });
      void queryClient.invalidateQueries({ queryKey: commsKeys.blocks });
    },
  });
}

export function useBlocks() {
  return useQuery({ queryKey: commsKeys.blocks, queryFn: () => api<BlockedUserDto[]>('/blocks') });
}

export function useUnblock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api(`/blocks/${userId}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: commsKeys.blocks }),
  });
}

export function useReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportInput) => api<ReportCreatedDto>('/reports', { method: 'POST', body: input }),
    onSuccess: (result) => {
      if (result.blocked) {
        void queryClient.invalidateQueries({ queryKey: commsKeys.matches });
        void queryClient.invalidateQueries({ queryKey: commsKeys.blocks });
      }
    },
  });
}

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: commsKeys.notifications,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api<NotificationPageDto>(`/notifications${pageParam ? `?before=${pageParam}` : ''}`, { signal }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: commsKeys.unread,
    queryFn: () => api<{ unreadCount: number }>('/notifications/unread-count'),
    select: (data) => data.unreadCount,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { all: true } | { ids: string[] }) =>
      api<{ unreadCount: number }>('/notifications/read', { method: 'POST', body: input }),
    onSuccess: (result) => {
      queryClient.setQueryData(commsKeys.unread, result);
      void queryClient.invalidateQueries({ queryKey: commsKeys.notifications, exact: true });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: commsKeys.preferences,
    queryFn: () => api<NotificationPreferencesDto>('/notifications/preferences'),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationPreferencesInput) =>
      api<NotificationPreferencesDto>('/notifications/preferences', { method: 'PUT', body: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: commsKeys.preferences });
      const previous = queryClient.getQueryData<NotificationPreferencesDto>(commsKeys.preferences);
      if (previous) queryClient.setQueryData(commsKeys.preferences, { ...previous, ...input });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(commsKeys.preferences, context.previous);
    },
    onSuccess: (data) => queryClient.setQueryData(commsKeys.preferences, data),
  });
}

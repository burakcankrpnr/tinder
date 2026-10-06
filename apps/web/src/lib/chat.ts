'use client';

import type { ApiResponse, ChatAttachmentUploadDto, ChatMessageDto } from '@dating/types';
import { type SendMessageInput, sendMessageSchema } from '@dating/validation';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api, errorMessage } from './api-client';
import {
  type PendingMessage,
  commsKeys,
  flattenMessages,
  patchMatchList,
  patchMessages,
  upsertMessage,
  useMessages,
} from './communication';
import { postToStorage, validatePhotoFile } from './photo-upload';
import { useRealtime, useRealtimeEvent } from './realtime';

const SEND_TIMEOUT_MS = 10_000;
const TYPING_EMIT_INTERVAL_MS = 2_500;
const TYPING_IDLE_MS = 3_000;
const TYPING_DISPLAY_MS = 5_000;

interface PendingEntry extends PendingMessage {
  input: SendMessageInput | null;
  file: File | null;
}

/**
 * Sohbet durumu: mesaj geçmişi, iyimser (pending) gönderimler, typing ve read receipt.
 * Gönderim önce socket ack ile denenir, bağlantı yoksa REST'e düşer; `clientMessageId` sayesinde
 * tekrar denemeler sunucuda çift mesaj üretmez.
 */
export function useChat(matchId: string, myUserId: string, otherUserId: string) {
  const queryClient = useQueryClient();
  const { socket, connected } = useRealtime();
  const messagesQuery = useMessages(matchId);
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmit = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messages = useMemo(() => flattenMessages(messagesQuery.data), [messagesQuery.data]);
  const visiblePending = useMemo(
    () => pending.filter((entry) => !messages.some((message) => message.clientMessageId === entry.clientMessageId)),
    [pending, messages],
  );

  useRealtimeEvent('typing', (payload) => {
    if (payload.matchId !== matchId || payload.userId !== otherUserId) return;
    setOtherTyping(payload.isTyping);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (payload.isTyping) typingTimer.current = setTimeout(() => setOtherTyping(false), TYPING_DISPLAY_MS);
  });
  useRealtimeEvent('message:new', (message) => {
    if (message.matchId === matchId && message.senderId === otherUserId) setOtherTyping(false);
  });

  const deliver = useCallback(
    async (input: SendMessageInput): Promise<ChatMessageDto> => {
      if (socket && connected) {
        try {
          const response: ApiResponse<ChatMessageDto> = await socket
            .timeout(SEND_TIMEOUT_MS)
            .emitWithAck('message:send', { matchId, message: input });
          if (response.success) return response.data;
          throw new ApiError(response.error.code, response.error.message, 400, response.error.details);
        } catch (error) {
          if (error instanceof ApiError) throw error;
          // Ack zaman aşımı: aynı clientMessageId ile REST üzerinden güvenle tekrar denenir.
        }
      }
      return api<ChatMessageDto>(`/matches/${matchId}/messages`, { method: 'POST', body: input });
    },
    [socket, connected, matchId],
  );

  const run = useCallback(
    async (entry: PendingEntry) => {
      setPending((current) => [
        ...current.filter((item) => item.clientMessageId !== entry.clientMessageId),
        { ...entry, status: 'sending', error: undefined },
      ]);
      try {
        let input = entry.input;
        if (!input && entry.file) {
          const upload = await api<ChatAttachmentUploadDto>(`/matches/${matchId}/attachments`, {
            method: 'POST',
            body: { contentType: entry.file.type, size: entry.file.size },
          });
          await postToStorage(upload.upload, entry.file, () => undefined);
          input = { type: 'IMAGE', clientMessageId: entry.clientMessageId, attachmentKey: upload.attachmentKey };
          const resolved = input;
          setPending((current) =>
            current.map((item) => (item.clientMessageId === entry.clientMessageId ? { ...item, input: resolved } : item)),
          );
        }
        if (!input) return;
        const message = await deliver(input);
        upsertMessage(queryClient, message);
        void queryClient.invalidateQueries({ queryKey: commsKeys.matches, exact: true });
        setPending((current) => current.filter((item) => item.clientMessageId !== entry.clientMessageId));
        if (entry.imagePreview) URL.revokeObjectURL(entry.imagePreview);
      } catch (error) {
        setPending((current) =>
          current.map((item) =>
            item.clientMessageId === entry.clientMessageId
              ? { ...item, status: 'failed', error: errorMessage(error) }
              : item,
          ),
        );
      }
    },
    [deliver, matchId, queryClient],
  );

  const sendText = useCallback(
    (body: string): string | null => {
      const input = { type: 'TEXT' as const, clientMessageId: crypto.randomUUID(), body };
      const parsed = sendMessageSchema.safeParse(input);
      if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Mesaj geçersiz.';
      void run({
        clientMessageId: input.clientMessageId,
        matchId,
        body: parsed.data.type === 'TEXT' ? parsed.data.body : null,
        imagePreview: null,
        createdAt: new Date().toISOString(),
        status: 'sending',
        input: parsed.data,
        file: null,
      });
      return null;
    },
    [matchId, run],
  );

  const sendImage = useCallback(
    (file: File): string | null => {
      const invalid = validatePhotoFile(file);
      if (invalid) return invalid;
      void run({
        clientMessageId: crypto.randomUUID(),
        matchId,
        body: null,
        imagePreview: URL.createObjectURL(file),
        createdAt: new Date().toISOString(),
        status: 'sending',
        input: null,
        file,
      });
      return null;
    },
    [matchId, run],
  );

  const retry = useCallback(
    (clientMessageId: string) => {
      const entry = pending.find((item) => item.clientMessageId === clientMessageId);
      if (entry) void run(entry);
    },
    [pending, run],
  );

  const discard = useCallback((clientMessageId: string) => {
    setPending((current) => {
      const entry = current.find((item) => item.clientMessageId === clientMessageId);
      if (entry?.imagePreview) URL.revokeObjectURL(entry.imagePreview);
      return current.filter((item) => item.clientMessageId !== clientMessageId);
    });
  }, []);

  const notifyTyping = useCallback(() => {
    if (!socket || !connected) return;
    const now = Date.now();
    if (now - lastTypingEmit.current > TYPING_EMIT_INTERVAL_MS) {
      lastTypingEmit.current = now;
      socket.emit('typing', { matchId, isTyping: true });
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      lastTypingEmit.current = 0;
      socket.emit('typing', { matchId, isTyping: false });
    }, TYPING_IDLE_MS);
  }, [socket, connected, matchId]);

  const stopTyping = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (lastTypingEmit.current !== 0 && socket && connected) socket.emit('typing', { matchId, isTyping: false });
    lastTypingEmit.current = 0;
  }, [socket, connected, matchId]);

  const remove = useCallback(
    async (messageId: string) => {
      await api(`/messages/${messageId}`, { method: 'DELETE' });
      patchMessages(queryClient, matchId, (message) =>
        message.id === messageId ? { ...message, deleted: true, body: null, image: null } : message,
      );
    },
    [matchId, queryClient],
  );

  // Sayfa görünürken karşı taraftan gelen okunmamış mesajlar okundu işaretlenir (read receipt).
  const lastIncomingUnread = useMemo(
    () => [...messages].reverse().find((message) => message.senderId === otherUserId && !message.readAt),
    [messages, otherUserId],
  );
  useEffect(() => {
    if (!lastIncomingUnread) return;
    const mark = () => {
      if (document.visibilityState !== 'visible') return;
      void api(`/matches/${matchId}/read`, { method: 'POST', body: { upToMessageId: lastIncomingUnread.id } })
        .then(() => {
          patchMatchList(queryClient, (match) => (match.id === matchId ? { ...match, unreadCount: 0 } : match));
          void queryClient.invalidateQueries({ queryKey: commsKeys.unread });
        })
        .catch(() => undefined);
    };
    mark();
    document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
  }, [lastIncomingUnread, matchId, queryClient]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    },
    [],
  );

  return {
    messagesQuery,
    messages,
    pending: visiblePending as PendingMessage[],
    otherTyping,
    connected,
    myUserId,
    sendText,
    sendImage,
    retry,
    discard,
    notifyTyping,
    stopTyping,
    remove,
  };
}

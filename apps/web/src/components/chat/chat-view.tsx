'use client';

import type { MatchDetailDto } from '@dating/types';
import { Alert, Button, Card, Spinner, buttonClasses } from '@dating/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApiError, errorMessage } from '@/lib/api-client';
import { useChat } from '@/lib/chat';
import { useBlockUser, useUnmatch } from '@/lib/communication';
import { formatDayLabel, formatRelative, isSameDay } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import { Avatar } from '../avatar';
import { BackIcon, MoreIcon } from '../icons';
import { Menu } from '../menu';
import { ConfirmDialog } from '../safety/confirm-dialog';
import { ReportDialog } from '../safety/report-dialog';
import { Composer } from './composer';
import { MessageBubble, PendingBubble } from './message-bubble';

const NEAR_BOTTOM_PX = 120;

type Dialog =
  | { kind: 'report'; messageId?: string }
  | { kind: 'block' }
  | { kind: 'unmatch' }
  | { kind: 'delete'; messageId: string }
  | null;

export function ChatUnavailable({ error }: { error: unknown }) {
  const gone = error instanceof ApiError && error.status === 404;
  return (
    <Card className="mx-auto max-w-md space-y-4 text-center">
      <Alert tone={gone ? 'info' : 'danger'} title={gone ? 'Bu eşleşme artık aktif değil' : 'Sohbet yüklenemedi'}>
        {gone ? 'Eşleşme sona ermiş olabilir.' : errorMessage(error)}
      </Alert>
      <Link href="/matches" className={buttonClasses({ variant: 'secondary', className: 'mx-auto' })}>
        Eşleşmelere dön
      </Link>
    </Card>
  );
}

export function ChatView({ match, myUserId }: { match: MatchDetailDto; myUserId: string }) {
  const router = useRouter();
  const other = match.user;
  const chat = useChat(match.id, myUserId, other.id);
  const unmatch = useUnmatch();
  const block = useBlockUser();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [ended, setEnded] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const restoreFrom = useRef<number | null>(null);
  const { messagesQuery, messages, pending } = chat;

  useRealtimeEvent('match:ended', ({ matchId }) => {
    if (matchId === match.id) setEnded(true);
  });

  const itemCount = messages.length + pending.length;
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (restoreFrom.current !== null) {
      element.scrollTop = element.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (nearBottom.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [itemCount, chat.otherTyping]);

  const loadOlder = () => {
    const element = scrollRef.current;
    if (!element || !messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage) return;
    restoreFrom.current = element.scrollHeight - element.scrollTop;
    void messagesQuery.fetchNextPage();
  };

  const topSentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = topSentinel.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadOlder();
      },
      { root, rootMargin: '200px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  const lastMineId = [...messages].reverse().find((message) => message.senderId === myUserId)?.id;
  const status = chat.otherTyping
    ? 'Yazıyor…'
    : match.online
      ? 'Çevrimiçi'
      : match.lastActiveAt
        ? `Son görülme ${formatRelative(match.lastActiveAt)}`
        : null;

  const confirmAction = async () => {
    if (!dialog) return;
    setActionError(null);
    try {
      if (dialog.kind === 'delete') {
        await chat.remove(dialog.messageId);
        setDialog(null);
      } else if (dialog.kind === 'unmatch') {
        await unmatch.mutateAsync(match.id);
        router.replace('/matches');
      } else if (dialog.kind === 'block') {
        await block.mutateAsync(other.id);
        router.replace('/matches');
      }
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  if (ended) return <ChatUnavailable error={new ApiError('NOT_FOUND', 'Eşleşme bitti.', 404)} />;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-2xl flex-col">
      <header className="border-text/5 flex items-center gap-3 border-b pb-3">
        <Link href="/matches" aria-label="Eşleşmelere dön" className="text-text-muted hover:text-text -ml-2 rounded-full p-2">
          <BackIcon />
        </Link>
        <Link href={`/profile/${other.username}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar photo={other.photo} name={other.firstName} online={match.online} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {other.firstName}, {other.age}
            </span>
            <span className="text-text-muted block text-xs" aria-live="polite">
              {status}
            </span>
          </span>
        </Link>
        <Menu
          label="Sohbet seçenekleri"
          items={[
            { label: 'Profili gör', onSelect: () => router.push(`/profile/${other.username}`) },
            { label: 'Şikayet et', onSelect: () => setDialog({ kind: 'report' }) },
            { label: 'Engelle', onSelect: () => setDialog({ kind: 'block' }), tone: 'danger' },
            { label: 'Eşleşmeyi kaldır', onSelect: () => setDialog({ kind: 'unmatch' }), tone: 'danger' },
          ]}
        >
          <MoreIcon />
        </Menu>
      </header>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
        }}
        className="flex-1 space-y-2 overflow-y-auto py-4"
        role="log"
        aria-label={`${other.firstName} ile sohbet`}
      >
        <div ref={topSentinel} />
        {messagesQuery.isPending ? (
          <div className="text-primary flex justify-center py-10">
            <Spinner className="size-6" label="Mesajlar yükleniyor" />
          </div>
        ) : messagesQuery.isError ? (
          <div className="space-y-3 text-center">
            <Alert tone="danger">{errorMessage(messagesQuery.error)}</Alert>
            <Button variant="secondary" size="sm" onClick={() => void messagesQuery.refetch()}>
              Tekrar dene
            </Button>
          </div>
        ) : (
          <>
            {messagesQuery.hasNextPage && (
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" loading={messagesQuery.isFetchingNextPage} onClick={loadOlder}>
                  Daha eski mesajlar
                </Button>
              </div>
            )}
            {messages.length === 0 && pending.length === 0 && (
              <div className="space-y-3 py-10 text-center">
                <Avatar photo={other.photo} name={other.firstName} size="lg" />
                <p className="font-semibold">{other.firstName} ile eşleştiniz!</p>
                <p className="text-text-muted text-sm">Bir merhaba ile başla. Kendin ol, saygılı ol.</p>
              </div>
            )}
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const mine = message.senderId === myUserId;
              return (
                <Fragment key={message.id}>
                  {(!previous || !isSameDay(previous.createdAt, message.createdAt)) && (
                    <p className="text-text-muted py-2 text-center text-xs font-medium">
                      {formatDayLabel(message.createdAt)}
                    </p>
                  )}
                  <MessageBubble
                    message={message}
                    mine={mine}
                    showReadState={message.id === lastMineId}
                    actions={
                      mine
                        ? [{ label: 'Mesajı sil', tone: 'danger', onSelect: () => setDialog({ kind: 'delete', messageId: message.id }) }]
                        : [{ label: 'Mesajı şikayet et', onSelect: () => setDialog({ kind: 'report', messageId: message.id }) }]
                    }
                  />
                </Fragment>
              );
            })}
            {pending.map((message) => (
              <PendingBubble
                key={message.clientMessageId}
                message={message}
                onRetry={() => chat.retry(message.clientMessageId)}
                onDiscard={() => chat.discard(message.clientMessageId)}
              />
            ))}
            {chat.otherTyping && (
              <p className="text-text-muted flex items-center gap-2 px-2 text-xs">
                <span aria-hidden className="bg-text-muted size-1.5 animate-pulse rounded-full" />
                {other.firstName} yazıyor…
              </p>
            )}
          </>
        )}
      </div>

      {!chat.connected && (
        <p className="text-text-muted pb-1 text-center text-xs" role="status">
          Canlı bağlantı kuruluyor… Mesajların yine de gönderilir.
        </p>
      )}
      <Composer
        onSendText={(body) => {
          nearBottom.current = true;
          return chat.sendText(body);
        }}
        onSendImage={(file) => {
          nearBottom.current = true;
          return chat.sendImage(file);
        }}
        onTyping={chat.notifyTyping}
        onStopTyping={chat.stopTyping}
        disabled={messagesQuery.isPending}
      />

      <ReportDialog
        open={dialog?.kind === 'report'}
        onClose={() => setDialog(null)}
        reportedUserId={other.id}
        reportedName={other.firstName}
        messageId={dialog?.kind === 'report' ? dialog.messageId : undefined}
        onReported={({ blocked }) => {
          if (blocked) router.replace('/matches');
        }}
      />
      <ConfirmDialog
        open={dialog !== null && dialog.kind !== 'report'}
        title={
          dialog?.kind === 'delete'
            ? 'Mesaj silinsin mi?'
            : dialog?.kind === 'block'
              ? `${other.firstName} engellensin mi?`
              : 'Eşleşme kaldırılsın mı?'
        }
        description={
          dialog?.kind === 'delete'
            ? 'Mesaj iki taraf için de silinir.'
            : dialog?.kind === 'block'
              ? 'Eşleşmeniz sona erer, birbirinizi bir daha görmezsiniz ve mesajlaşamazsınız.'
              : 'Sohbet iki taraf için de kapanır. Bu işlem geri alınamaz.'
        }
        confirmLabel={dialog?.kind === 'delete' ? 'Sil' : dialog?.kind === 'block' ? 'Engelle' : 'Kaldır'}
        loading={unmatch.isPending || block.isPending}
        error={actionError}
        onClose={() => {
          setDialog(null);
          setActionError(null);
        }}
        onConfirm={() => void confirmAction()}
      />
    </div>
  );
}

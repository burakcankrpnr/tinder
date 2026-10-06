'use client';

import type { ChatMessageDto } from '@dating/types';
import { cx } from '@dating/ui';
import type { PendingMessage } from '@/lib/communication';
import { formatTime } from '@/lib/format';
import { CheckIcon, MoreIcon } from '../icons';
import { Menu, type MenuItem } from '../menu';

function Ticks({ read, onAccent }: { read: boolean; onAccent: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex',
        read ? (onAccent ? 'text-on-accent' : 'text-primary-soft') : onAccent ? 'text-on-accent/70' : 'text-text/60',
      )}
    >
      <CheckIcon className="size-3.5" />
      {read && <CheckIcon className="-ml-2 size-3.5" />}
      <span className="sr-only">{read ? 'Okundu' : 'Gönderildi'}</span>
    </span>
  );
}

function bubbleClasses(mine: boolean): string {
  return cx(
    'max-w-[80%] rounded-3xl px-4 py-2.5 text-sm shadow-sm',
    mine ? 'bg-accent-gradient text-on-accent rounded-br-lg' : 'bg-surface-2 text-text rounded-bl-lg',
  );
}

export function MessageBubble({
  message,
  mine,
  showReadState,
  actions,
}: {
  message: ChatMessageDto;
  mine: boolean;
  /** Yalnızca son gönderilen mesajda okundu/gönderildi gösterilir. */
  showReadState: boolean;
  actions: MenuItem[];
}) {
  return (
    <div className={cx('group flex items-end gap-1', mine ? 'flex-row-reverse' : 'flex-row')}>
      <div className={bubbleClasses(mine)}>
        {message.deleted ? (
          <p className={cx('italic', mine ? 'text-on-accent/70' : 'text-text/70')}>Bu mesaj silindi</p>
        ) : message.image ? (
          <a href={message.image.url} target="_blank" rel="noreferrer" className="block">
            <img
              src={message.image.url}
              alt={mine ? 'Gönderdiğin fotoğraf' : 'Gelen fotoğraf'}
              width={message.image.width ?? undefined}
              height={message.image.height ?? undefined}
              loading="lazy"
              className="max-h-80 w-auto max-w-full rounded-2xl object-contain"
            />
          </a>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        )}
        <p className={cx('mt-1 flex items-center justify-end gap-1 text-[11px]', mine ? 'text-on-accent/80' : 'text-text-muted')}>
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          {mine && showReadState && <Ticks read={message.readAt !== null} onAccent />}
        </p>
      </div>
      {!message.deleted && actions.length > 0 && (
        <Menu
          label="Mesaj seçenekleri"
          items={actions}
          align={mine ? 'right' : 'left'}
          buttonClassName="size-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:aria-expanded:opacity-100"
        >
          <MoreIcon className="size-4" />
        </Menu>
      )}
    </div>
  );
}

export function PendingBubble({
  message,
  onRetry,
  onDiscard,
}: {
  message: PendingMessage;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const failed = message.status === 'failed';
  return (
    <div className="flex flex-col items-end gap-1">
      <div className={cx(bubbleClasses(true), !failed && 'opacity-70', failed && 'ring-danger ring-2')}>
        {message.imagePreview ? (
          <img src={message.imagePreview} alt="Gönderilen fotoğraf" className="max-h-80 rounded-2xl object-contain" />
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        )}
        <p className="text-on-accent/80 mt-1 text-right text-[11px]">{failed ? 'Gönderilemedi' : 'Gönderiliyor…'}</p>
      </div>
      {failed && (
        <p className="text-danger flex items-center gap-3 text-xs" role="alert">
          {message.error}
          <button type="button" className="font-semibold underline" onClick={onRetry}>
            Tekrar dene
          </button>
          <button type="button" className="text-text-muted underline" onClick={onDiscard}>
            Vazgeç
          </button>
        </p>
      )}
    </div>
  );
}

'use client';

import { MAX_MESSAGE_LENGTH } from '@dating/validation';
import { controlClasses, cx } from '@dating/ui';
import { useRef, useState } from 'react';
import { ACCEPTED_PHOTO_TYPES } from '@/lib/photo-upload';
import { ImageIcon, SendIcon } from '../icons';

const iconButton =
  'focus-visible:outline-primary inline-flex size-11 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-2 disabled:opacity-40';

export function Composer({
  onSendText,
  onSendImage,
  onTyping,
  onStopTyping,
  disabled,
}: {
  onSendText: (body: string) => string | null;
  onSendImage: (file: File) => string | null;
  onTyping: () => void;
  onStopTyping: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const resize = () => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
  };

  const submit = () => {
    if (!value.trim()) return;
    const problem = onSendText(value);
    setError(problem);
    if (problem) return;
    setValue('');
    onStopTyping();
    requestAnimationFrame(() => {
      resize();
      textareaRef.current?.focus();
    });
  };

  return (
    <div className="border-text/5 space-y-2 border-t pt-3">
      {error && (
        <p role="alert" className="text-danger px-2 text-xs">
          {error}
        </p>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_PHOTO_TYPES}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) setError(onSendImage(file));
          }}
        />
        <button
          type="button"
          aria-label="Fotoğraf gönder"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className={cx(iconButton, 'text-text-muted hover:text-text hover:bg-text/5')}
        >
          <ImageIcon />
        </button>
        <label htmlFor="chat-message" className="sr-only">
          Mesaj
        </label>
        <textarea
          id="chat-message"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Bir mesaj yaz…"
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
            resize();
            if (event.target.value) onTyping();
          }}
          onBlur={onStopTyping}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          className={cx(controlClasses, 'max-h-36 min-h-11 flex-1 resize-none py-2.5 leading-6')}
        />
        <button
          type="submit"
          aria-label="Gönder"
          disabled={disabled || !value.trim()}
          className={cx(iconButton, 'bg-accent-gradient text-on-accent shadow-lg')}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

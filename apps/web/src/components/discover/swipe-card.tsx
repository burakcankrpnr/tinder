'use client';

import type { DiscoveryCardDto } from '@dating/types';
import { Tag, cx } from '@dating/ui';
import Image from 'next/image';
import { type PointerEvent, type Ref, useImperativeHandle, useRef, useState } from 'react';
import type { DeckAction } from '@/lib/discovery';

const SWIPE_THRESHOLD_PX = 110;
const VELOCITY_THRESHOLD = 0.6;
const EXIT_MS = 260;

export interface SwipeCardHandle {
  fling: (action: DeckAction) => void;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function SwipeCard({
  card,
  active,
  onSwipe,
  onOpen,
  ref,
}: {
  card: DiscoveryCardDto;
  active: boolean;
  onSwipe: (action: DeckAction) => void;
  onOpen: () => void;
  ref?: Ref<SwipeCardHandle>;
}) {
  const element = useRef<HTMLDivElement>(null);
  const likeStamp = useRef<HTMLSpanElement>(null);
  const passStamp = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ x: number; y: number; t: number; pointerId: number } | null>(null);
  const leaving = useRef(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = card.photos[Math.min(photoIndex, card.photos.length - 1)];

  const setTransform = (dx: number, dy: number, animate: boolean) => {
    const node = element.current;
    if (!node) return;
    node.style.transition = animate ? `transform ${EXIT_MS}ms cubic-bezier(.2,.8,.2,1)` : 'none';
    node.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${dx / 18}deg)`;
    const ratio = Math.min(Math.abs(dx) / SWIPE_THRESHOLD_PX, 1);
    if (likeStamp.current) likeStamp.current.style.opacity = dx > 0 ? String(ratio) : '0';
    if (passStamp.current) passStamp.current.style.opacity = dx < 0 ? String(ratio) : '0';
  };

  const fling = (action: DeckAction) => {
    if (leaving.current) return;
    leaving.current = true;
    if (prefersReducedMotion()) {
      onSwipe(action);
      return;
    }
    if (action === 'SUPER_LIKE') setTransform(0, -window.innerHeight * 1.2, true);
    else setTransform((action === 'LIKE' ? 1 : -1) * window.innerWidth * 1.2, 40, true);
    window.setTimeout(() => onSwipe(action), EXIT_MS);
  };

  useImperativeHandle(ref, () => ({ fling }));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!active || leaving.current || event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, t: performance.now(), pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setTransform(event.clientX - start.x, (event.clientY - start.y) * 0.3, false);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    drag.current = null;
    const dx = event.clientX - start.x;
    const velocity = Math.abs(dx) / Math.max(performance.now() - start.t, 1);

    if (Math.abs(dx) > SWIPE_THRESHOLD_PX || (Math.abs(dx) > 40 && velocity > VELOCITY_THRESHOLD)) {
      fling(dx > 0 ? 'LIKE' : 'PASS');
      return;
    }
    if (Math.abs(dx) < 6) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const tapX = event.clientX - bounds.left;
      if (card.photos.length > 1) {
        setPhotoIndex((index) =>
          tapX > bounds.width / 2
            ? Math.min(index + 1, card.photos.length - 1)
            : Math.max(index - 1, 0),
        );
      }
    }
    setTransform(0, 0, true);
  };

  return (
    <div
      ref={element}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
        setTransform(0, 0, true);
      }}
      aria-hidden={!active}
      className={cx(
        'bg-surface-2 absolute inset-0 touch-none overflow-hidden rounded-card shadow-2xl select-none will-change-transform',
        active ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none scale-[0.96] opacity-80',
      )}
    >
      {photo ? (
        <Image
          src={photo.urls.large}
          alt={`${card.firstName}, fotoğraf ${photoIndex + 1}`}
          fill
          unoptimized
          priority={active}
          draggable={false}
          sizes="(min-width: 640px) 420px, 100vw"
          className="object-cover"
        />
      ) : null}

      {card.photos.length > 1 && (
        <div className="absolute inset-x-3 top-3 flex gap-1" aria-hidden>
          {card.photos.map((item, index) => (
            <span
              key={item.id}
              className={cx('h-1 flex-1 rounded-full', index === photoIndex ? 'bg-text' : 'bg-text/35')}
            />
          ))}
        </div>
      )}

      <span
        ref={likeStamp}
        aria-hidden
        className="border-success text-success absolute top-10 left-6 -rotate-12 rounded-xl border-4 px-3 py-1 text-3xl font-black tracking-wider opacity-0"
      >
        LIKE
      </span>
      <span
        ref={passStamp}
        aria-hidden
        className="border-danger text-danger absolute top-10 right-6 rotate-12 rounded-xl border-4 px-3 py-1 text-3xl font-black tracking-wider opacity-0"
      >
        PAS
      </span>

      <div className="from-bg-bottom via-bg-bottom/70 absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t to-transparent p-5 pt-24">
        {card.superLikedYou && (
          <span className="bg-accent-gradient text-on-accent inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold">
            <span aria-hidden>★</span> Seni Super Like’ladı
          </span>
        )}
        <div className="flex items-end gap-2">
          <h2 className="text-3xl font-semibold">
            {card.firstName}
            {card.age != null ? `, ${card.age}` : ''}
          </h2>
          {card.verified && (
            <span className="bg-primary/25 text-primary-soft mb-1 rounded-full px-2 py-0.5 text-xs">
              Doğrulanmış
            </span>
          )}
        </div>
        <p className="text-text-muted text-sm">
          {card.distanceKm != null ? `${card.distanceKm} km uzakta` : ''}
          {card.distanceKm != null && card.city ? ' · ' : ''}
          {card.city ?? ''}
        </p>
        {card.bio && <p className="line-clamp-2 text-sm">{card.bio}</p>}
        {card.interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {card.interests.slice(0, 5).map((interest) => (
              <Tag
                key={interest.slug}
                className={cx(card.commonInterests.includes(interest.slug) && 'bg-primary/30 text-text')}
              >
                {interest.name}
              </Tag>
            ))}
          </div>
        )}
        <button
          type="button"
          tabIndex={active ? 0 : -1}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onOpen}
          className="text-primary-soft focus-visible:outline-primary text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2"
        >
          Profili aç
        </button>
      </div>
    </div>
  );
}

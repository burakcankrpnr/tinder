'use client';

import type { KeyboardEvent, ReactNode } from 'react';

function amountFor(scroller: HTMLElement) {
  const card = scroller.querySelector('article');
  return (card?.getBoundingClientRect().width ?? 340) + 20;
}

export function scrollCarousel(id: string, direction: -1 | 1) {
  const scroller = document.getElementById(id);
  if (!scroller) return;
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  scroller.scrollBy({ left: amountFor(scroller) * direction, behavior });
}

export function CarouselButtons({ target }: { target: string }) {
  return (
    <div className="carousel-controls">
      <button type="button" aria-label="Önceki" onClick={() => scrollCarousel(target, -1)}>
        ←
      </button>
      <button type="button" aria-label="Sonraki" onClick={() => scrollCarousel(target, 1)}>
        →
      </button>
    </div>
  );
}

export function Carousel({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    scrollCarousel(id, event.key === 'ArrowRight' ? 1 : -1);
  };

  return (
    <div id={id} className="carousel" tabIndex={0} aria-label={label} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

'use client';

import type { DiscoveryCardDto, DiscoveryFeedDto } from '@dating/types';
import { Alert, Button, Card, Modal, buttonClasses } from '@dating/ui';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePaywall } from '@/components/billing/paywall';
import { ProfileView } from '@/components/profile/profile-view';
import { SafetyActions } from '@/components/safety/safety-actions';
import { errorMessage } from '@/lib/api-client';
import { isPaywallError, useActivateBoost, useEntitlements, useRewind } from '@/lib/billing';
import { type DeckAction, useDiscoveryDeck } from '@/lib/discovery';
import { MatchModal } from './match-modal';
import { SwipeCard, type SwipeCardHandle } from './swipe-card';

const SUGGESTION_LABELS: Record<DiscoveryFeedDto['suggestions'][number], string> = {
  INCREASE_DISTANCE: 'Mesafeyi artır',
  WIDEN_AGE_RANGE: 'Yaş aralığını genişlet',
  TRY_LATER: 'Daha sonra tekrar dene',
};

function DeckSkeleton() {
  return (
    <div aria-busy="true" aria-label="Profiller yükleniyor" className="bg-surface-2/70 absolute inset-0 animate-pulse rounded-card">
      <div className="absolute inset-x-5 bottom-6 space-y-3">
        <div className="bg-text/10 h-7 w-1/2 rounded-full" />
        <div className="bg-text/10 h-4 w-1/3 rounded-full" />
        <div className="bg-text/10 h-4 w-3/4 rounded-full" />
      </div>
    </div>
  );
}

function boostTimeLeft(activeUntil: string): string {
  const minutes = Math.max(1, Math.ceil((new Date(activeUntil).getTime() - Date.now()) / 60_000));
  return `${minutes} dk`;
}

export function DiscoverDeck() {
  const paywall = usePaywall();
  const deck = useDiscoveryDeck({ onPaywall: paywall.open });
  const entitlements = useEntitlements();
  const rewind = useRewind();
  const boost = useActivateBoost();
  const topCard = useRef<SwipeCardHandle>(null);
  const [details, setDetails] = useState<DiscoveryCardDto | null>(null);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [current, next] = deck.cards;
  const perks = entitlements.data;

  const act = (action: DeckAction) => {
    if (action === 'SUPER_LIKE' && perks && perks.superLikes.remaining === 0) {
      paywall.open('Super Like hakkın kalmadı. Plus veya Premium ile her hafta yeni Super Like kazanırsın.');
      return;
    }
    topCard.current?.fling(action);
  };

  const undo = () => {
    if (perks && !perks.features.rewind) {
      paywall.open('Son seçimini geri almak için Plus veya Premium’a geç.');
      return;
    }
    setNotice(null);
    rewind.mutate(undefined, {
      onSuccess: (result) => {
        if (result.card) deck.restore(result.card);
        else setNotice('Bu profil artık görüntülenemiyor.');
      },
      onError: (error) => (isPaywallError(error) ? paywall.open(error.message) : setNotice(errorMessage(error))),
    });
  };

  const activateBoost = () => {
    setNotice(null);
    boost.mutate(undefined, {
      onSuccess: () => setNotice('Boost aktif! Önümüzdeki 30 dakika boyunca daha çok kişiye gösterileceksin.'),
      onError: (error) =>
        isPaywallError(error)
          ? paywall.open('Boost hakkın yok. Premium her ay Boost içerir; tek seferlik Boost da alabilirsin.')
          : setNotice(errorMessage(error)),
    });
  };

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (details || deck.match || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight') topCard.current?.fling('LIKE');
      if (event.key === 'ArrowLeft') topCard.current?.fling('PASS');
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        topCard.current?.fling('SUPER_LIKE');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [details, deck.match]);

  const empty = deck.status === 'ready' && deck.cards.length === 0 && deck.exhausted;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="sr-only">Keşfet</h1>

      {!online && (
        <Alert tone="warning" title="Çevrimdışısın">
          Bağlantı geri geldiğinde kaldığın yerden devam edebilirsin.
        </Alert>
      )}
      {perks && (
        <div className="text-text-muted flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            {perks.likes.remaining === null ? 'Sınırsız like' : `Bugün ${perks.likes.remaining} like hakkın kaldı`}
          </span>
          <span className="flex items-center gap-3">
            <span>★ {perks.superLikes.remaining}</span>
            {perks.boosts.activeUntil ? (
              <span className="text-warning">⚡ Boost aktif · {boostTimeLeft(perks.boosts.activeUntil)}</span>
            ) : (
              <button
                type="button"
                onClick={activateBoost}
                disabled={boost.isPending}
                className="text-primary-soft focus-visible:outline-primary rounded-full underline-offset-4 hover:underline focus-visible:outline-2 disabled:opacity-50"
              >
                ⚡ Boost ({perks.boosts.remaining})
              </button>
            )}
          </span>
        </div>
      )}
      {notice && (
        <Alert tone="info">
          {notice}{' '}
          <button type="button" className="underline" onClick={() => setNotice(null)}>
            Kapat
          </button>
        </Alert>
      )}
      {deck.swipeError && (
        <Alert tone="danger">
          {deck.swipeError}{' '}
          <button type="button" className="underline" onClick={deck.dismissSwipeError}>
            Kapat
          </button>
        </Alert>
      )}

      {deck.status === 'error' ? (
        <Card className="space-y-4 text-center">
          <Alert tone="danger" title="Profiller yüklenemedi">
            {deck.loadError}
          </Alert>
          <Button onClick={deck.retry}>Tekrar dene</Button>
        </Card>
      ) : empty ? (
        <Card className="space-y-5 py-10 text-center">
          <div aria-hidden className="bg-accent-gradient mx-auto size-16 rounded-3xl opacity-80" />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Şu an yakınında yeni profil bulunamadı.</h2>
            <p className="text-text-muted text-sm">Tercihlerini biraz esnetirsen daha çok kişi görebilirsin.</p>
          </div>
          <div className="flex flex-col gap-2">
            {deck.suggestions
              .filter((suggestion) => suggestion !== 'TRY_LATER')
              .map((suggestion) => (
                <Link
                  key={suggestion}
                  href="/profile#preferences"
                  className={buttonClasses({ variant: 'secondary', fullWidth: true })}
                >
                  {SUGGESTION_LABELS[suggestion]}
                </Link>
              ))}
            <Button variant="ghost" fullWidth onClick={deck.retry}>
              {SUGGESTION_LABELS.TRY_LATER}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <section aria-label="Profil kartları" aria-live="polite" className="relative aspect-[3/4] w-full">
            {deck.status === 'loading' || !current ? (
              <DeckSkeleton />
            ) : (
              <>
                {next && <SwipeCard key={next.id} card={next} active={false} onSwipe={() => undefined} onOpen={() => undefined} />}
                <SwipeCard
                  key={current.id}
                  ref={topCard}
                  card={current}
                  active
                  onSwipe={(action) => void deck.swipe(current, action)}
                  onOpen={() => setDetails(current)}
                />
              </>
            )}
          </section>

          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label="Son seçimi geri al"
              disabled={rewind.isPending}
              onClick={undo}
              className="border-warning/40 bg-surface text-warning hover:bg-warning/10 focus-visible:outline-primary flex size-12 items-center justify-center rounded-full border-2 text-lg shadow-lg transition focus-visible:outline-2 disabled:opacity-40"
            >
              ↺
            </button>
            <button
              type="button"
              aria-label="Pas geç (sol ok)"
              disabled={!current}
              onClick={() => act('PASS')}
              className="border-danger/40 bg-surface text-danger hover:bg-danger/10 focus-visible:outline-primary flex size-16 items-center justify-center rounded-full border-2 text-2xl shadow-lg transition focus-visible:outline-2 disabled:opacity-40"
            >
              ✕
            </button>
            <button
              type="button"
              aria-label="Super Like (yukarı ok)"
              disabled={!current}
              onClick={() => act('SUPER_LIKE')}
              className="border-primary/50 bg-surface text-primary hover:bg-primary/10 focus-visible:outline-primary flex size-14 items-center justify-center rounded-full border-2 text-xl shadow-lg transition focus-visible:outline-2 disabled:opacity-40"
            >
              ★
            </button>
            <button
              type="button"
              aria-label="Beğen (sağ ok)"
              disabled={!current}
              onClick={() => act('LIKE')}
              className="bg-accent-gradient text-on-accent focus-visible:outline-primary flex size-20 items-center justify-center rounded-full text-3xl shadow-xl transition hover:brightness-110 focus-visible:outline-2 disabled:opacity-40"
            >
              ♥
            </button>
          </div>
          <p className="text-text-muted text-center text-xs">Kartı sürükle veya ← ↑ → tuşlarını kullan.</p>
        </>
      )}

      <Modal open={details !== null} onClose={() => setDetails(null)} title={details ? details.firstName : 'Profil'} hideTitle className="max-w-3xl">
        {details && (
          <div className="space-y-6">
            <ProfileView profile={details} />
            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setDetails(null);
                  act('PASS');
                }}
              >
                Pas geç
              </Button>
              <Button
                fullWidth
                onClick={() => {
                  setDetails(null);
                  act('LIKE');
                }}
              >
                Beğen
              </Button>
            </div>
            <SafetyActions
              userId={details.id}
              name={details.firstName}
              onDone={() => {
                deck.remove(details.id);
                setDetails(null);
              }}
            />
          </div>
        )}
      </Modal>

      <MatchModal match={deck.match} onClose={deck.dismissMatch} />
    </div>
  );
}

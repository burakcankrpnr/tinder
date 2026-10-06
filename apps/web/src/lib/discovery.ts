'use client';

import type { DiscoveryCardDto, DiscoveryFeedDto, MatchSummaryDto, SwipeResultDto } from '@dating/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, errorMessage } from './api-client';
import { billingKeys, isPaywallError } from './billing';

const BATCH_SIZE = 10;
const REFILL_THRESHOLD = 3;

export type DeckAction = 'LIKE' | 'PASS' | 'SUPER_LIKE';

type DeckStatus = 'loading' | 'ready' | 'error';

/** Bu hatalarda swipe sunucuda kalıcı olmuş ya da kart artık geçersizdir; kartı geri koymaya gerek yok. */
function isTerminal(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 409);
}

function preload(cards: DiscoveryCardDto[]): void {
  for (const card of cards.slice(0, 3)) {
    const url = card.photos[0]?.urls.large;
    if (url) new window.Image().src = url;
  }
}

export function useDiscoveryDeck(options: { onPaywall?: (message: string) => void } = {}) {
  const queryClient = useQueryClient();
  const onPaywall = useRef(options.onPaywall);
  useEffect(() => {
    onPaywall.current = options.onPaywall;
  }, [options.onPaywall]);
  const [cards, setCards] = useState<DiscoveryCardDto[]>([]);
  const [status, setStatus] = useState<DeckStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [swipeError, setSwipeError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<DiscoveryFeedDto['suggestions']>([]);
  const [exhausted, setExhausted] = useState(false);
  const [match, setMatch] = useState<MatchSummaryDto | null>(null);

  const cardsRef = useRef(cards);
  const fetching = useRef(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    cardsRef.current = cards;
    preload(cards);
  }, [cards]);

  const refill = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const exclude = cardsRef.current.map((card) => card.id).join(',');
      const feed = await api<DiscoveryFeedDto>(
        `/discovery?limit=${BATCH_SIZE}${exclude ? `&exclude=${exclude}` : ''}`,
      );
      const fresh = feed.cards.filter((card) => !seen.current.has(card.id));
      for (const card of fresh) seen.current.add(card.id);
      setCards((current) => [...current, ...fresh]);
      setSuggestions(feed.suggestions);
      setExhausted(feed.cards.length === 0);
      setLoadError(null);
      setStatus('ready');
    } catch (error) {
      setLoadError(errorMessage(error));
      setStatus((current) => (current === 'loading' ? 'error' : current));
    } finally {
      fetching.current = false;
    }
  }, []);

  useEffect(() => {
    void refill();
  }, [refill]);

  useEffect(() => {
    if (status === 'ready' && !exhausted && cards.length < REFILL_THRESHOLD) void refill();
  }, [cards.length, exhausted, status, refill]);

  /** Kart animasyonu ağı beklemez: kart hemen düşer, istek başarısız olursa geri gelir. */
  const swipe = useCallback(async (card: DiscoveryCardDto, action: DeckAction) => {
    setSwipeError(null);
    setCards((current) => current.filter((item) => item.id !== card.id));
    try {
      const result = await api<SwipeResultDto>('/swipes', {
        method: 'POST',
        body: { targetUserId: card.id, action },
      });
      if (result.match) setMatch(result.match);
      if (action !== 'PASS') void queryClient.invalidateQueries({ queryKey: billingKeys.entitlements });
    } catch (error) {
      if (isTerminal(error)) return;
      setCards((current) => [card, ...current.filter((item) => item.id !== card.id)]);
      if (isPaywallError(error) && onPaywall.current) {
        onPaywall.current(error.message);
        return;
      }
      setSwipeError(errorMessage(error));
    }
  }, [queryClient]);

  const retry = useCallback(() => {
    seen.current = new Set(cardsRef.current.map((card) => card.id));
    setExhausted(false);
    setStatus((current) => (current === 'error' ? 'loading' : current));
    void refill();
  }, [refill]);

  return {
    cards,
    status,
    loadError,
    swipeError,
    suggestions,
    exhausted,
    match,
    swipe,
    retry,
    /** Engellenen/şikayet edilen profili swipe olmadan desteden çıkarır. */
    remove: (cardId: string) => setCards((current) => current.filter((item) => item.id !== cardId)),
    /** Rewind ile geri gelen kartı destenin en üstüne koyar. */
    restore: (card: DiscoveryCardDto) => {
      seen.current.add(card.id);
      setCards((current) => [card, ...current.filter((item) => item.id !== card.id)]);
    },
    dismissMatch: () => setMatch(null),
    dismissSwipeError: () => setSwipeError(null),
  };
}

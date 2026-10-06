/**
 * Recommendation V1 (spec Bölüm 17): ML yok, açıklanabilir ağırlıklı skor.
 * Tercih uyumu (cinsiyet/yaş karşılıklılığı, mesafe sınırı) SQL'de filtre olarak uygulanır;
 * burada yalnızca filtreden geçen adaylar sıralanır.
 */
export interface RankingCandidate {
  userId: string;
  distanceKm: number;
  lastActiveAt: Date | null;
  onboardingCompletedAt: Date;
  approvedPhotoCount: number;
  bioLength: number;
  interestCount: number;
  commonInterestCount: number;
  likedViewer: boolean;
  superLikedViewer?: boolean;
  previouslyPassed: boolean;
  /** Aktif Boost için 1; yoksa paketin görünürlük katkısı (0-1). */
  boostFactor?: number;
  /** Açık şikayet sayısı gibi risk sinyalleri (0-1). */
  riskFactor?: number;
}

export const RANKING_WEIGHTS = {
  distance: 30,
  activity: 20,
  completeness: 15,
  compatibility: 15,
  freshness: 10,
  likedViewer: 10,
  superLikedViewer: 15,
  boost: 40,
  repeatedExposure: 10,
  risk: 50,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const FRESH_PROFILE_DAYS = 7;

export function activityScore(lastActiveAt: Date | null, now: Date): number {
  if (!lastActiveAt) return 0;
  const days = (now.getTime() - lastActiveAt.getTime()) / DAY_MS;
  if (days <= 1) return 1;
  if (days <= 3) return 0.7;
  if (days <= 7) return 0.4;
  if (days <= 30) return 0.15;
  return 0;
}

export function completenessScore(candidate: RankingCandidate): number {
  return (
    (Math.min(candidate.approvedPhotoCount, 3) / 3) * 0.5 +
    (candidate.bioLength >= 20 ? 0.25 : 0) +
    (candidate.interestCount > 0 ? 0.25 : 0)
  );
}

export function scoreCandidate(candidate: RankingCandidate, maxDistanceKm: number, now: Date): number {
  const distance = 1 - Math.min(candidate.distanceKm / Math.max(maxDistanceKm, 1), 1);
  const compatibility = Math.min(candidate.commonInterestCount, 3) / 3;
  const freshDays = (now.getTime() - candidate.onboardingCompletedAt.getTime()) / DAY_MS;

  return (
    distance * RANKING_WEIGHTS.distance +
    activityScore(candidate.lastActiveAt, now) * RANKING_WEIGHTS.activity +
    completenessScore(candidate) * RANKING_WEIGHTS.completeness +
    compatibility * RANKING_WEIGHTS.compatibility +
    (freshDays <= FRESH_PROFILE_DAYS ? RANKING_WEIGHTS.freshness : 0) +
    (candidate.likedViewer ? RANKING_WEIGHTS.likedViewer : 0) +
    (candidate.superLikedViewer ? RANKING_WEIGHTS.superLikedViewer : 0) +
    (candidate.boostFactor ?? 0) * RANKING_WEIGHTS.boost -
    (candidate.previouslyPassed ? RANKING_WEIGHTS.repeatedExposure : 0) -
    (candidate.riskFactor ?? 0) * RANKING_WEIGHTS.risk
  );
}

export function rankCandidates<T extends RankingCandidate>(
  candidates: readonly T[],
  maxDistanceKm: number,
  now: Date = new Date(),
): T[] {
  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, maxDistanceKm, now) }))
    .sort((a, b) => b.score - a.score || a.candidate.distanceKm - b.candidate.distanceKm)
    .map(({ candidate }) => candidate);
}

/** Mesafe kartta tam sayı km olarak, en az 1 km gösterilir. */
export function displayDistance(distanceKm: number): number {
  return Math.max(1, Math.round(distanceKm));
}

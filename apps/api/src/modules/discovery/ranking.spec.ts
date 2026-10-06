import { describe, expect, it } from 'vitest';
import {
  type RankingCandidate,
  activityScore,
  completenessScore,
  displayDistance,
  rankCandidates,
  scoreCandidate,
} from './ranking';

const NOW = new Date('2026-10-06T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function candidate(overrides: Partial<RankingCandidate> = {}): RankingCandidate {
  return {
    userId: 'u',
    distanceKm: 10,
    lastActiveAt: new Date(NOW.getTime() - DAY / 2),
    onboardingCompletedAt: new Date(NOW.getTime() - 30 * DAY),
    approvedPhotoCount: 1,
    bioLength: 0,
    interestCount: 0,
    commonInterestCount: 0,
    likedViewer: false,
    previouslyPassed: false,
    ...overrides,
  };
}

describe('activityScore', () => {
  it('decays with inactivity', () => {
    expect(activityScore(null, NOW)).toBe(0);
    expect(activityScore(new Date(NOW.getTime() - DAY / 2), NOW)).toBe(1);
    expect(activityScore(new Date(NOW.getTime() - 2 * DAY), NOW)).toBe(0.7);
    expect(activityScore(new Date(NOW.getTime() - 5 * DAY), NOW)).toBe(0.4);
    expect(activityScore(new Date(NOW.getTime() - 20 * DAY), NOW)).toBe(0.15);
    expect(activityScore(new Date(NOW.getTime() - 60 * DAY), NOW)).toBe(0);
  });
});

describe('completenessScore', () => {
  it('rewards photos, bio and interests', () => {
    expect(completenessScore(candidate())).toBeCloseTo(0.5 / 3);
    expect(completenessScore(candidate({ approvedPhotoCount: 5, bioLength: 40, interestCount: 2 }))).toBe(1);
  });
});

describe('scoreCandidate', () => {
  it('prefers closer, more active and more compatible profiles', () => {
    const base = scoreCandidate(candidate(), 50, NOW);
    expect(scoreCandidate(candidate({ distanceKm: 2 }), 50, NOW)).toBeGreaterThan(base);
    expect(scoreCandidate(candidate({ lastActiveAt: null }), 50, NOW)).toBeLessThan(base);
    expect(scoreCandidate(candidate({ commonInterestCount: 3 }), 50, NOW)).toBeGreaterThan(base);
    expect(scoreCandidate(candidate({ likedViewer: true }), 50, NOW)).toBeGreaterThan(base);
    expect(scoreCandidate(candidate({ onboardingCompletedAt: NOW }), 50, NOW)).toBeGreaterThan(base);
  });

  it('applies boost and penalties', () => {
    const base = scoreCandidate(candidate(), 50, NOW);
    expect(scoreCandidate(candidate({ boostFactor: 1 }), 50, NOW)).toBeGreaterThan(base);
    expect(scoreCandidate(candidate({ previouslyPassed: true }), 50, NOW)).toBeLessThan(base);
    expect(scoreCandidate(candidate({ riskFactor: 1 }), 50, NOW)).toBeLessThan(base);
  });

  it('treats distances beyond the limit as zero distance score', () => {
    expect(scoreCandidate(candidate({ distanceKm: 80 }), 50, NOW)).toBe(
      scoreCandidate(candidate({ distanceKm: 50 }), 50, NOW),
    );
  });
});

describe('rankCandidates', () => {
  it('orders by score and breaks ties by distance', () => {
    const ranked = rankCandidates(
      [
        candidate({ userId: 'inactive', lastActiveAt: null }),
        candidate({ userId: 'tie-far', distanceKm: 10.2 }),
        candidate({ userId: 'liked-me', likedViewer: true }),
        candidate({ userId: 'tie-near', distanceKm: 10.2 }),
      ].map((item, index) => (item.userId === 'tie-near' ? { ...item, distanceKm: 10.2 - 1e-9 * index } : item)),
      50,
      NOW,
    );
    expect(ranked.map((item) => item.userId)).toEqual(['liked-me', 'tie-near', 'tie-far', 'inactive']);
  });
});

describe('displayDistance', () => {
  it('never reveals sub-kilometre precision', () => {
    expect(displayDistance(0.2)).toBe(1);
    expect(displayDistance(7.6)).toBe(8);
  });
});

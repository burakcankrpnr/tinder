import type { OnboardingStep } from '@dating/types';

export interface CompletenessInput {
  profile: {
    bio: string | null;
    occupation: string | null;
    education: string | null;
    heightCm: number | null;
    languages: string[];
    relationshipIntention: string | null;
    drinking: string | null;
    smoking: string | null;
    exercise: string | null;
    latitude: number | null;
  } | null;
  hasPreferences: boolean;
  photoCount: number;
  interestCount: number;
}

const MIN_BIO_LENGTH = 20;

/** 0-100 arası ağırlıklı profil doluluk skoru (discovery sıralamasında kullanılır). */
export function calculateCompleteness(input: CompletenessInput): number {
  const { profile } = input;
  let score = 0;

  if (profile) score += 20;
  score += (Math.min(input.photoCount, 3) / 3) * 25;
  score += (Math.min(input.interestCount, 3) / 3) * 10;
  if (input.hasPreferences) score += 10;

  if (profile) {
    if (profile.latitude !== null) score += 10;
    if ((profile.bio?.length ?? 0) >= MIN_BIO_LENGTH) score += 10;
    if (profile.occupation) score += 3;
    if (profile.education) score += 3;
    if (profile.relationshipIntention) score += 3;
    if (profile.heightCm) score += 2;
    if (profile.languages.length > 0) score += 2;
    if (profile.drinking || profile.smoking || profile.exercise) score += 2;
  }

  return Math.round(Math.min(score, 100));
}

export function nextOnboardingStep(input: CompletenessInput): OnboardingStep | null {
  if (!input.profile) return 'profile';
  if (input.photoCount === 0) return 'photos';
  if (!input.hasPreferences) return 'preferences';
  if (input.profile.latitude === null) return 'location';
  return null;
}

/** Konumu ~1 km hassasiyetine yuvarlar; kesin koordinat saklanmaz. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

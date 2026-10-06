import { describe, expect, it } from 'vitest';
import {
  type CompletenessInput,
  calculateCompleteness,
  nextOnboardingStep,
  roundCoordinate,
} from './profile-completeness';

const emptyProfile: NonNullable<CompletenessInput['profile']> = {
  bio: null,
  occupation: null,
  education: null,
  heightCm: null,
  languages: [],
  relationshipIntention: null,
  drinking: null,
  smoking: null,
  exercise: null,
  latitude: null,
};

function input(overrides: Partial<CompletenessInput> = {}): CompletenessInput {
  return { profile: emptyProfile, hasPreferences: false, photoCount: 0, interestCount: 0, ...overrides };
}

describe('calculateCompleteness', () => {
  it('is 0 without a profile', () => {
    expect(calculateCompleteness(input({ profile: null }))).toBe(0);
  });

  it('gives the base score for a bare profile', () => {
    expect(calculateCompleteness(input())).toBe(20);
  });

  it('scales photos and interests up to three items', () => {
    expect(calculateCompleteness(input({ photoCount: 1 }))).toBe(28);
    expect(calculateCompleteness(input({ photoCount: 3, interestCount: 3 }))).toBe(55);
    expect(calculateCompleteness(input({ photoCount: 6, interestCount: 10 }))).toBe(55);
  });

  it('only counts a bio of meaningful length', () => {
    const short = { ...emptyProfile, bio: 'Merhaba' };
    const long = { ...emptyProfile, bio: 'Kahve, kitaplar ve uzun yürüyüşler.' };
    expect(calculateCompleteness(input({ profile: short }))).toBe(20);
    expect(calculateCompleteness(input({ profile: long }))).toBe(30);
  });

  it('reaches 100 for a fully filled profile', () => {
    const full = {
      bio: 'Kahve, kitaplar ve uzun yürüyüşler.',
      occupation: 'Mimar',
      education: 'Lisans',
      heightCm: 170,
      languages: ['tr', 'en'],
      relationshipIntention: 'LONG_TERM',
      drinking: 'SOMETIMES',
      smoking: 'NEVER',
      exercise: 'OFTEN',
      latitude: 41.01,
    };
    expect(
      calculateCompleteness({ profile: full, hasPreferences: true, photoCount: 3, interestCount: 5 }),
    ).toBe(100);
  });
});

describe('nextOnboardingStep', () => {
  it('walks the steps in order', () => {
    expect(nextOnboardingStep(input({ profile: null }))).toBe('profile');
    expect(nextOnboardingStep(input())).toBe('photos');
    expect(nextOnboardingStep(input({ photoCount: 1 }))).toBe('preferences');
    expect(nextOnboardingStep(input({ photoCount: 1, hasPreferences: true }))).toBe('location');
    expect(
      nextOnboardingStep(
        input({ photoCount: 1, hasPreferences: true, profile: { ...emptyProfile, latitude: 39.9 } }),
      ),
    ).toBeNull();
  });
});

describe('roundCoordinate', () => {
  it('keeps roughly 1 km precision', () => {
    expect(roundCoordinate(41.008238)).toBe(41.01);
    expect(roundCoordinate(-73.985664)).toBe(-73.99);
  });
});

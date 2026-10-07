import { describe, expect, it } from 'vitest';
import { photoUploadRequestSchema } from './photos';
import { interestsSchema, locationSchema, preferencesSchema, profileBasicsSchema, usernameSchema } from './profile';
import { zodiacFromDate } from './profile-prompts';

describe('usernameSchema', () => {
  it('normalizes to lowercase', () => {
    expect(usernameSchema.parse('  Ayse.Yilmaz ')).toBe('ayse.yilmaz');
  });

  it.each(['ab', 'a'.repeat(21), '.ayse', 'ayse.', 'ay..se', 'ayşe', 'ay se', '_ayse'])(
    'rejects invalid username %j',
    (value) => {
      expect(usernameSchema.safeParse(value).success).toBe(false);
    },
  );

  it('rejects reserved usernames', () => {
    expect(usernameSchema.safeParse('Admin').success).toBe(false);
    expect(usernameSchema.safeParse('onboarding').success).toBe(false);
  });
});

describe('profileBasicsSchema', () => {
  const base = { firstName: 'Ayşe', username: 'ayse', gender: 'WOMAN' };

  it('turns empty optional fields into null', () => {
    const parsed = profileBasicsSchema.parse({
      ...base,
      bio: '',
      city: '  ',
      country: '',
      heightCm: '',
      relationshipIntention: '',
      drinking: '',
    });
    expect(parsed).toMatchObject({
      bio: null,
      city: null,
      country: null,
      heightCm: null,
      relationshipIntention: null,
      drinking: null,
      languages: [],
    });
  });

  it('coerces height and normalizes country and languages', () => {
    const parsed = profileBasicsSchema.parse({
      ...base,
      heightCm: '172',
      country: 'tr',
      languages: ['TR', 'en', 'tr'],
    });
    expect(parsed).toMatchObject({ heightCm: 172, country: 'TR', languages: ['tr', 'en'] });
  });

  it('reads zodiac from the UTC calendar day', () => {
    expect(zodiacFromDate(new Date(Date.UTC(1995, 10, 8)))).toBe('SCORPIO');
    expect(zodiacFromDate(new Date(Date.UTC(1990, 0, 1)))).toBe('CAPRICORN');
    expect(zodiacFromDate(new Date(Date.UTC(1992, 2, 21)))).toBe('ARIES');
  });

  it('rejects out of range height and non-letter names', () => {
    expect(profileBasicsSchema.safeParse({ ...base, heightCm: 90 }).success).toBe(false);
    expect(profileBasicsSchema.safeParse({ ...base, firstName: 'Ayşe123' }).success).toBe(false);
  });
});

describe('preferencesSchema', () => {
  const valid = { interestedIn: ['MAN'], ageMin: 25, ageMax: 35, maxDistanceKm: 50 };

  it('accepts a valid range', () => {
    expect(preferencesSchema.parse(valid)).toEqual(valid);
  });

  it('requires ageMin >= 18 and ageMin <= ageMax', () => {
    expect(preferencesSchema.safeParse({ ...valid, ageMin: 17 }).success).toBe(false);
    const inverted = preferencesSchema.safeParse({ ...valid, ageMin: 40 });
    expect(inverted.success).toBe(false);
    expect(inverted.error?.issues[0]?.path).toEqual(['ageMax']);
  });

  it('requires at least one gender and a bounded distance', () => {
    expect(preferencesSchema.safeParse({ ...valid, interestedIn: [] }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...valid, maxDistanceKm: 500 }).success).toBe(false);
  });
});

describe('interestsSchema / locationSchema', () => {
  it('limits interests to 10 and deduplicates', () => {
    expect(interestsSchema.parse({ interestIds: [1, 1, 2] }).interestIds).toEqual([1, 2]);
    expect(interestsSchema.safeParse({ interestIds: Array.from({ length: 11 }, (_, i) => i + 1) }).success).toBe(
      false,
    );
  });

  it('validates coordinate ranges', () => {
    expect(locationSchema.safeParse({ latitude: 41, longitude: 29 }).success).toBe(true);
    expect(locationSchema.safeParse({ latitude: 91, longitude: 29 }).success).toBe(false);
    expect(locationSchema.safeParse({ latitude: 41, longitude: -181 }).success).toBe(false);
  });
});

describe('photoUploadRequestSchema', () => {
  it('allows only supported image types up to 10 MB', () => {
    expect(photoUploadRequestSchema.safeParse({ contentType: 'image/jpeg', size: 1024 }).success).toBe(true);
    expect(photoUploadRequestSchema.safeParse({ contentType: 'image/gif', size: 1024 }).success).toBe(false);
    expect(photoUploadRequestSchema.safeParse({ contentType: 'image/png', size: 11 * 1024 * 1024 }).success).toBe(
      false,
    );
  });
});

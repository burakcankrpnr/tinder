import { z } from 'zod';

export const GENDERS = ['WOMAN', 'MAN', 'NON_BINARY'] as const;
export const RELATIONSHIP_INTENTIONS = [
  'LONG_TERM',
  'LONG_TERM_OPEN_TO_SHORT',
  'SHORT_TERM_OPEN_TO_LONG',
  'SHORT_TERM',
  'FRIENDSHIP',
  'NOT_SURE',
] as const;
export const LIFESTYLE_FREQUENCIES = ['NEVER', 'SOMETIMES', 'OFTEN'] as const;

export const MAX_INTERESTS = 10;
export const MAX_LANGUAGES = 5;
export const MAX_BIO_LENGTH = 500;
export const MIN_PREFERENCE_AGE = 18;
export const MAX_PREFERENCE_AGE = 100;
export const MAX_DISTANCE_KM = 200;

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'api',
  'app',
  'discover',
  'help',
  'likes',
  'login',
  'logout',
  'matches',
  'me',
  'moderator',
  'notifications',
  'onboarding',
  'pricing',
  'privacy',
  'profile',
  'register',
  'root',
  'safety',
  'settings',
  'subscription',
  'support',
  'system',
  'terms',
]);

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_]|\.(?!\.)){1,18}[a-z0-9]$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Kullanıcı adı en az 3 karakter olmalı.')
  .max(20, 'Kullanıcı adı en fazla 20 karakter olabilir.')
  .regex(USERNAME_PATTERN, 'Sadece harf, rakam, nokta ve alt çizgi kullanabilirsin.')
  .refine((value) => !RESERVED_USERNAMES.has(value), 'Bu kullanıcı adı kullanılamaz.');

function optionalText(max: number) {
  return z
    .union([z.string().trim().max(max, `En fazla ${max} karakter olabilir.`), z.null()])
    .optional()
    .transform((value) => (value ? value : null));
}

function optionalEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .union([z.enum(values), z.literal(''), z.null()])
    .optional()
    .transform((value): T[number] | null => (value ? value : null));
}

const countryCodeSchema = z
  .union([
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'Ülke kodu 2 harfli olmalı (ör. TR).'),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .transform((value) => (value ? value : null));

export const profileBasicsSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'İsim gerekli.')
    .max(40, 'İsim en fazla 40 karakter olabilir.')
    .regex(/^[\p{L}][\p{L}\s'-]*$/u, 'İsim yalnızca harf içerebilir.'),
  username: usernameSchema,
  gender: z.enum(GENDERS, { message: 'Cinsiyet seç.' }),
  bio: optionalText(MAX_BIO_LENGTH),
  city: optionalText(80),
  country: countryCodeSchema,
  occupation: optionalText(80),
  education: optionalText(80),
  heightCm: z
    .union([z.coerce.number().int().min(120).max(230), z.literal(''), z.null()])
    .optional()
    .transform((value) => (typeof value === 'number' ? value : null)),
  languages: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z]{2}$/),
    )
    .max(MAX_LANGUAGES, `En fazla ${MAX_LANGUAGES} dil seçebilirsin.`)
    .default([])
    .transform((values) => [...new Set(values)]),
  relationshipIntention: optionalEnum(RELATIONSHIP_INTENTIONS),
  drinking: optionalEnum(LIFESTYLE_FREQUENCIES),
  smoking: optionalEnum(LIFESTYLE_FREQUENCIES),
  exercise: optionalEnum(LIFESTYLE_FREQUENCIES),
});

const preferenceAge = z.coerce
  .number()
  .int()
  .min(MIN_PREFERENCE_AGE, `Yaş en az ${MIN_PREFERENCE_AGE} olmalı.`)
  .max(MAX_PREFERENCE_AGE);

export const preferencesSchema = z
  .object({
    interestedIn: z
      .array(z.enum(GENDERS))
      .min(1, 'En az bir seçenek seç.')
      .transform((values) => [...new Set(values)]),
    ageMin: preferenceAge,
    ageMax: preferenceAge,
    maxDistanceKm: z.coerce.number().int().min(1).max(MAX_DISTANCE_KM),
  })
  .refine((value) => value.ageMin <= value.ageMax, {
    message: 'Minimum yaş, maksimum yaştan büyük olamaz.',
    path: ['ageMax'],
  });

export const interestsSchema = z.object({
  interestIds: z
    .array(z.number().int().positive())
    .max(MAX_INTERESTS, `En fazla ${MAX_INTERESTS} ilgi alanı seçebilirsin.`)
    .transform((values) => [...new Set(values)]),
});

export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  city: optionalText(80),
  country: countryCodeSchema,
});

export const usernameQuerySchema = z.object({ username: usernameSchema });

export const usernameParamSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(20),
});

export type ProfileBasicsInput = z.infer<typeof profileBasicsSchema>;
export type ProfileBasicsFormInput = z.input<typeof profileBasicsSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type PreferencesFormInput = z.input<typeof preferencesSchema>;
export type InterestsInput = z.infer<typeof interestsSchema>;
export type LocationInput = z.infer<typeof locationSchema>;

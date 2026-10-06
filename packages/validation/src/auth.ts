import { z } from 'zod';
import { MINIMUM_AGE, isAllowedAge } from './age';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Geçerli bir email adresi gir.' }).max(254));

export const passwordSchema = z
  .string()
  .min(10, 'Şifre en az 10 karakter olmalı.')
  .max(128, 'Şifre en fazla 128 karakter olabilir.')
  .regex(/[A-Za-z]/, 'Şifre en az bir harf içermeli.')
  .regex(/\d/, 'Şifre en az bir rakam içermeli.');

export const birthDateSchema = z.iso
  .date({ message: 'Doğum tarihi YYYY-MM-DD formatında olmalı.' })
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((date) => isAllowedAge(date), {
    message: `Platformu kullanmak için en az ${MINIMUM_AGE} yaşında olmalısın.`,
  });

const tokenSchema = z.string().trim().min(32).max(256);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  birthDate: birthDateSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const verifyEmailSchema = z.object({ token: tokenSchema });

export const emailOnlySchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});

export const sessionIdParamSchema = z.object({ id: z.uuid() });

/** Mobil istemci refresh token'ı cookie yerine gövdede taşır. */
export const refreshTokenBodySchema = z
  .object({
    refreshToken: z.string().min(32).max(512).optional(),
  })
  .optional()
  .transform((value) => value ?? {});

export const DELETE_ACCOUNT_CONFIRMATION = 'SİL';

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirmation: z.literal(DELETE_ACCOUNT_CONFIRMATION, {
    message: `Onay için ${DELETE_ACCOUNT_CONFIRMATION} yazmalısın.`,
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormInput = z.input<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type RefreshTokenBody = z.infer<typeof refreshTokenBodySchema>;

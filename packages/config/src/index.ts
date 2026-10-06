import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  NEXT_PUBLIC_APP_URL: z.url(),
  /** Telefondan açılan mail bağlantıları. Boşsa NEXT_PUBLIC_APP_URL kullanılır. */
  EMAIL_LINK_ORIGIN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.url().optional(),
  ),
  API_URL: z.url().default('http://localhost:4000'),
  CORS_ORIGINS: optionalString,
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  MAIL_FROM: z.string().min(1),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  STORAGE_ENDPOINT: z.url(),
  STORAGE_REGION: z.string().min(1).default('us-east-1'),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_UPLOAD_BUCKET: z.string().min(3),
  STORAGE_MEDIA_BUCKET: z.string().min(3),
  STORAGE_PUBLIC_URL: z.url(),
  STORAGE_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  STORAGE_AUTO_PROVISION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SENTRY_DSN: optionalString,
  WEB_PUSH_PUBLIC_KEY: optionalString,
  WEB_PUSH_PRIVATE_KEY: optionalString,
  WEB_PUSH_SUBJECT: optionalString,
  PAYMENT_PROVIDER: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(['mock']).default('mock'),
  ),
  PAYMENT_SECRET_KEY: optionalString,
  /** Boşsa (yalnızca development/test) her açılışta rastgele üretilir. */
  PAYMENT_WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform((value) => (value === '' ? undefined : value))
    .pipe(z.string().min(32).optional()),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;
  if (!env.PAYMENT_WEBHOOK_SECRET) {
    ctx.addIssue({ code: 'custom', path: ['PAYMENT_WEBHOOK_SECRET'], message: 'Production ortamında zorunludur' });
  }
  if (env.PAYMENT_PROVIDER === 'mock') {
    ctx.addIssue({ code: 'custom', path: ['PAYMENT_PROVIDER'], message: 'Mock provider production ortamında kullanılamaz' });
  }
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = apiEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid API environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const webEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_MEDIA_URL: z.url(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

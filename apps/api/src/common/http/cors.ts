import type { ApiEnv } from '@dating/config';

export function allowedOrigins(env: ApiEnv): string[] {
  const extra = env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()) ?? [];
  return [new URL(env.NEXT_PUBLIC_APP_URL).origin, ...extra.filter(Boolean)];
}

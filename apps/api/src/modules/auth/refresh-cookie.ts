import type { CookieOptions, Request, Response } from 'express';

export const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function baseOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax', path: REFRESH_COOKIE_PATH };
}

export function setRefreshCookie(
  response: Response,
  token: string,
  expiresAt: Date,
  secure: boolean,
): void {
  response.cookie(REFRESH_COOKIE, token, { ...baseOptions(secure), expires: expiresAt });
}

export function clearRefreshCookie(response: Response, secure: boolean): void {
  response.clearCookie(REFRESH_COOKIE, baseOptions(secure));
}

export function readRefreshCookie(request: Request): string | undefined {
  const cookies: unknown = request.cookies;
  if (typeof cookies !== 'object' || cookies === null) return undefined;
  const value = (cookies as Record<string, unknown>)[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

import type { ApiErrorBody, ApiResponse, AuthResultDto, ErrorCode } from '@dating/types';
import { publicEnv } from './env';

const API_BASE = `${publicEnv.apiUrl}/api/v1`;
const REFRESH_LOCK = 'dating-auth-refresh';

export class ApiError extends Error {
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly status: number;
  readonly details: ApiErrorBody['details'];

  constructor(code: ApiError['code'], message: string, status: number, details?: ApiErrorBody['details']) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<AuthResultDto | null> | null = null;
const sessionListeners = new Set<(result: AuthResultDto | null) => void>();

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Oturum yenilendiğinde veya düştüğünde (refresh başarısız) haber verir. */
export function onSessionChange(listener: (result: AuthResultDto | null) => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function emitSession(result: AuthResultDto | null): void {
  for (const listener of sessionListeners) listener(result);
}

async function requestRefresh(): Promise<AuthResultDto | null> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
    const body = (await response.json()) as ApiResponse<AuthResultDto>;
    return body.success ? body.data : null;
  } catch {
    return null;
  }
}

/**
 * Refresh token her kullanımda döndürülür ve eski token tekrar gelirse tüm oturum ailesi iptal edilir.
 * Bu yüzden yenileme hem sekme içinde (tek promise) hem sekmeler arasında (Web Locks) tekilleştirilir.
 */
export function refreshSession(): Promise<AuthResultDto | null> {
  refreshInFlight ??= (async () => {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    const result = locks
      ? await locks.request(REFRESH_LOCK, requestRefresh)
      : await requestRefresh();
    setAccessToken(result?.accessToken ?? null);
    emitSession(result);
    return result;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

async function send<T>(path: string, options: RequestOptions): Promise<{ status: number; body: ApiResponse<T> }> {
  const headers: Record<string, string> = { ...options.headers, Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
      cache: 'no-store',
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('NETWORK_ERROR', 'Sunucuya ulaşılamadı. Bağlantını kontrol et.', 0);
  }

  try {
    return { status: response.status, body: (await response.json()) as ApiResponse<T> };
  } catch {
    throw new ApiError('INTERNAL_ERROR', 'Beklenmeyen bir yanıt alındı.', response.status);
  }
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let { status, body } = await send<T>(path, options);

  if (status === 401 && accessToken !== null) {
    const refreshed = await refreshSession();
    if (refreshed) ({ status, body } = await send<T>(path, options));
  }

  if (body.success) return body.data;
  throw new ApiError(body.error.code, body.error.message, status, body.error.details);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Bir şeyler ters gitti. Lütfen tekrar dene.';
}

export function apiBaseUrl(): string {
  return publicEnv.apiUrl;
}

export function googleLoginUrl(): string {
  return `${API_BASE}/auth/google`;
}

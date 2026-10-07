import type { ApiErrorBody, ApiResponse, AuthResultDto, ErrorCode } from '@dating/types';
import { File, UploadType, type UploadResult } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const API_BASE = `${API_ORIGIN}/api/v1`;
const REFRESH_KEY = 'dating.refresh';

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
let refreshToken: string | null = null;
let refreshInFlight: Promise<AuthResultDto | null> | null = null;

const sessionListeners = new Set<(result: AuthResultDto | null) => void>();

export function onSessionChange(listener: (result: AuthResultDto | null) => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function emit(result: AuthResultDto | null): void {
  for (const listener of sessionListeners) listener(result);
}

async function remember(result: AuthResultDto | null): Promise<void> {
  accessToken = result?.accessToken ?? null;
  refreshToken = result?.refreshToken ?? null;
  if (result?.refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, result.refreshToken);
  else await SecureStore.deleteItemAsync(REFRESH_KEY);
  emit(result);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
}

async function send<T>(path: string, options: RequestOptions): Promise<{ status: number; body: ApiResponse<T> }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Client': 'mobile',
    ...options.headers,
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Sunucuya ulaşılamadı. Bağlantını kontrol et.', 0);
  }

  try {
    return { status: response.status, body: (await response.json()) as ApiResponse<T> };
  } catch {
    throw new ApiError('INTERNAL_ERROR', 'Beklenmeyen bir yanıt alındı.', response.status);
  }
}

async function refreshSession(): Promise<AuthResultDto | null> {
  refreshInFlight ??= (async () => {
    const token = refreshToken ?? (await SecureStore.getItemAsync(REFRESH_KEY));
    refreshToken = token;
    if (!token) {
      await remember(null);
      return null;
    }
    try {
      const { body } = await send<AuthResultDto>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: token },
        auth: false,
      });
      if (!body.success || !body.data.refreshToken) {
        await remember(null);
        return null;
      }
      await remember(body.data);
      return body.data;
    } catch {
      await remember(null);
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function loadSession(): Promise<AuthResultDto | null> {
  refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) {
    emit(null);
    return null;
  }
  return refreshSession();
}

export async function saveSession(result: AuthResultDto): Promise<void> {
  if (!result.refreshToken) throw new ApiError('INTERNAL_ERROR', 'Oturum açılamadı.', 0);
  await remember(result);
}

export async function adoptRefreshToken(token: string): Promise<AuthResultDto | null> {
  refreshToken = token;
  await SecureStore.setItemAsync(REFRESH_KEY, token);
  return refreshSession();
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let { status, body } = await send<T>(path, options);
  if (status === 401 && options.auth !== false && accessToken) {
    const refreshed = await refreshSession();
    if (refreshed) ({ status, body } = await send<T>(path, options));
  }
  if (body.success) return body.data;
  throw new ApiError(body.error.code, body.error.message, status, body.error.details);
}

export async function logoutSession(): Promise<void> {
  const token = refreshToken ?? (await SecureStore.getItemAsync(REFRESH_KEY));
  try {
    if (token) {
      await send('/auth/logout', { method: 'POST', body: { refreshToken: token }, auth: false });
    }
  } finally {
    await remember(null);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Bir şeyler ters gitti. Lütfen tekrar dene.';
}

export function googleStartUrl(): string {
  return `${API_BASE}/auth/google`;
}

/** Telefondan depolama portu kapalıdır. Görseller API üzerinden okunur. */
export function deviceUrl(url: string): string {
  try {
    const target = new URL(url);
    const api = new URL(API_ORIGIN);
    if (target.origin === api.origin) return url;
    const local = target.hostname === 'localhost' || target.hostname === '127.0.0.1' || target.port === '9000';
    if (!local) return url;
    const parts = target.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return url;
    const key = parts.slice(1).map((part) => encodeURIComponent(part)).join('/');
    return `${API_ORIGIN}/api/v1/photos/media/${key}`;
  } catch {
    return url;
  }
}

export async function uploadPhotoContent(
  photoId: string,
  file: { uri: string; name: string; type: string },
): Promise<void> {
  const post = async (): Promise<UploadResult> => {
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Client': 'mobile' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return new File(file.uri).upload(`${API_BASE}/photos/${photoId}/content`, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: file.type,
      headers,
    });
  };

  let result: UploadResult;
  try {
    result = await post();
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'bağlantı koptu';
    console.warn(`photo-upload: ${detail}`);
    throw new ApiError('NETWORK_ERROR', 'Fotoğraf sunucuya ulaşamadı. Telefon ve bilgisayar aynı Wi-Fi ağında olmalı.', 0);
  }
  if (result.status === 401 && accessToken) {
    const refreshed = await refreshSession();
    if (refreshed) {
      try {
        result = await post();
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'bağlantı koptu';
        console.warn(`photo-upload: ${detail}`);
        throw new ApiError('NETWORK_ERROR', 'Fotoğraf sunucuya ulaşamadı. Telefon ve bilgisayar aynı Wi-Fi ağında olmalı.', 0);
      }
    }
  }
  if (result.status === 0) {
    console.warn('photo-upload: sunucu yanıt vermedi');
    throw new ApiError('NETWORK_ERROR', 'Fotoğraf sunucuya ulaşamadı. Telefon ve bilgisayar aynı Wi-Fi ağında olmalı.', 0);
  }

  let body: ApiResponse<{ message: string }>;
  try {
    body = JSON.parse(result.body) as ApiResponse<{ message: string }>;
  } catch {
    console.warn(`photo-upload: geçersiz yanıt ${result.status}`);
    throw new ApiError('INTERNAL_ERROR', 'Beklenmeyen bir yanıt alındı.', result.status);
  }
  if (!body.success) throw new ApiError(body.error.code, body.error.message, result.status, body.error.details);
}

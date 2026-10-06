import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  deviceName: string | null;
}

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Chrome\//, 'Chrome'],
  [/Firefox\//, 'Firefox'],
  [/Safari\//, 'Safari'],
];

const PLATFORMS: Array<[RegExp, string]> = [
  [/Windows/, 'Windows'],
  [/iPhone|iPad/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X/, 'macOS'],
  [/Linux/, 'Linux'],
];

export function describeDevice(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const platform = PLATFORMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (!browser && !platform) return null;
  return [browser ?? 'Bilinmeyen tarayıcı', platform].filter(Boolean).join(' / ');
}

export function getRequestMeta(request: Request): RequestMeta {
  const rawAgent = request.headers['user-agent'];
  const userAgent = typeof rawAgent === 'string' ? rawAgent.slice(0, 512) : null;
  return {
    ip: request.ip ?? null,
    userAgent,
    deviceName: describeDevice(userAgent),
  };
}

export const ReqMeta = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestMeta =>
    getRequestMeta(context.switchToHttp().getRequest<Request>()),
);

import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { ApiEnv } from '@dating/config';
import type { Request } from 'express';
import { ENV } from '../../config/env.module';
import { AppException } from '../http/app.exception';
import { allowedOrigins } from '../http/cors';

/**
 * Cookie ile kimlik doğrulayan endpoint'ler için CSRF koruması:
 * tarayıcıdan gelen isteklerde Origin header'ı izinli origin'lerden biri olmalı.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly origins: Set<string>;

  constructor(@Inject(ENV) env: ApiEnv) {
    this.origins = new Set(allowedOrigins(env));
  }

  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().headers.origin;
    if (origin !== undefined && !this.origins.has(origin)) {
      throw AppException.forbidden('İzin verilmeyen origin.');
    }
    return true;
  }
}

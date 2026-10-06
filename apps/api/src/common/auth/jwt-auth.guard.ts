import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException } from '../http/app.exception';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from './decorators';
import { TokenService } from '../../modules/auth/token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WebSocket bağlantıları handshake'te gateway middleware'inde doğrulanır.
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      if (token && this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, targets)) {
        const user = await this.tokens.verifyAccessToken(token).catch(() => null);
        if (user) request.user = user;
      }
      return true;
    }

    if (!token) throw AppException.unauthorized();
    request.user = await this.tokens.verifyAccessToken(token);
    return true;
  }
}

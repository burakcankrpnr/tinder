import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@dating/types';
import type { Request } from 'express';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AppException } from '../http/app.exception';
import { ROLES_KEY } from './decorators';
import { canAuthenticate } from './user-status';

/**
 * Rol gerektiren uçlarda token'daki role güvenmekle yetinmez: rol, hesap durumu ve oturum
 * DB'den doğrulanır. Böylece rolü alınan veya yasaklanan bir yönetici token süresini beklemeden düşer.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const user = context.switchToHttp().getRequest<Request>().user;
    if (!user || !roles.includes(user.role)) throw AppException.forbidden();

    const session = await this.prisma.session.findFirst({
      where: { id: user.sessionId, userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { user: { select: { role: true, status: true, deletedAt: true } } },
    });
    if (!session || !canAuthenticate(session.user) || !roles.includes(session.user.role)) {
      throw AppException.forbidden();
    }
    return true;
  }
}

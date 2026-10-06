import { type ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import type { UserRole } from '@dating/types';
import type { Request } from 'express';
import type { AuthUser } from './auth-user';
import { AppException } from '../http/app.exception';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

export const OPTIONAL_AUTH_KEY = 'auth:optional';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Public uçta geçerli bir token varsa `request.user` doldurulur; yoksa/geçersizse anonim devam edilir. */
export const OptionalAuth = (): MethodDecorator & ClassDecorator => SetMetadata(OPTIONAL_AUTH_KEY, true);

export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = context.switchToHttp().getRequest<Request>().user;
    if (!user) throw AppException.unauthorized();
    return user;
  },
);

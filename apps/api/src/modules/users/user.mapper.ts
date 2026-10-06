import type { User } from '@dating/database';
import type { CurrentUserDto } from '@dating/types';

/** Yalnızca hesabın sahibine dönen alanlar; iç ID'ler, hash'ler ve IP bilgisi dahil edilmez. */
export function toCurrentUserDto(user: User): CurrentUserDto {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

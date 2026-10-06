import type { UserStatus } from '@dating/database';

const LOCKED_OUT: readonly UserStatus[] = ['DEACTIVATED', 'BANNED'];

/** Silinmiş, kapatılmış veya yasaklanmış hesaplar oturum açamaz/yenileyemez. */
export function canAuthenticate(user: { deletedAt: Date | null; status: UserStatus }): boolean {
  return !user.deletedAt && !LOCKED_OUT.includes(user.status);
}

import type { Prisma } from '@dating/database';
import type { MatchUserDto } from '@dating/types';
import { calculateAge } from '@dating/validation';
import { variantUrls } from '../photos/photo.mapper';

export const matchUserSelect = {
  id: true,
  birthDate: true,
  profile: { select: { firstName: true, username: true } },
  photos: { where: { status: 'APPROVED' }, orderBy: { position: 'asc' }, take: 1 },
} satisfies Prisma.UserSelect;

export type MatchUserRecord = Prisma.UserGetPayload<{ select: typeof matchUserSelect }>;

export function toMatchUserDto(user: MatchUserRecord, publicUrl: (key: string) => string): MatchUserDto {
  const photo = user.photos[0];
  return {
    id: user.id,
    firstName: user.profile?.firstName ?? '',
    username: user.profile?.username ?? '',
    age: calculateAge(user.birthDate),
    photo: photo ? variantUrls(photo, publicUrl) : null,
  };
}

/** Match satırlarında çift her zaman (küçük id, büyük id) sırasıyla tutulur. */
export function orderedPair(first: string, second: string): { userAId: string; userBId: string } {
  return first < second ? { userAId: first, userBId: second } : { userAId: second, userBId: first };
}

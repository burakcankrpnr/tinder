import type { Prisma } from '@dating/database';
import type { PublicProfileDto } from '@dating/types';
import { calculateAge, zodiacFromDate } from '@dating/validation';
import { variantUrls } from '../photos/photo.mapper';

/** Public profil için gereken ilişkiler; e-posta, doğum tarihi, koordinat gibi alanlar DTO'ya taşınmaz. */
export const publicProfileInclude = {
  user: {
    select: {
      id: true,
      birthDate: true,
      status: true,
      deletedAt: true,
      interests: {
        include: { interest: true },
        orderBy: { interest: { sortOrder: 'asc' } },
      },
      photos: { where: { status: 'APPROVED' }, orderBy: { position: 'asc' } },
    },
  },
} satisfies Prisma.UserProfileInclude;

export type PublicProfileRecord = Prisma.UserProfileGetPayload<{ include: typeof publicProfileInclude }>;

export function isPubliclyVisible(profile: PublicProfileRecord): boolean {
  return (
    profile.onboardingCompletedAt !== null &&
    profile.user.deletedAt === null &&
    profile.user.status === 'ACTIVE'
  );
}

function rotate<T>(items: T[], shift: number): T[] {
  if (items.length < 2 || shift === 0) return items;
  const index = shift % items.length;
  return [...items.slice(index), ...items.slice(0, index)];
}

export function toPublicProfileDto(
  profile: PublicProfileRecord,
  publicUrl: (key: string) => string,
): PublicProfileDto {
  const photos = profile.user.photos.flatMap((photo) => {
    const urls = variantUrls(photo, publicUrl);
    return urls ? [{ id: photo.id, contentType: photo.contentType, urls }] : [];
  });
  return {
    id: profile.userId,
    firstName: profile.firstName,
    username: profile.username,
    age: profile.hideAge ? null : calculateAge(profile.user.birthDate),
    gender: profile.gender,
    bio: profile.bio,
    city: profile.city,
    country: profile.country,
    occupation: profile.occupation,
    education: profile.education,
    educationLevel: profile.educationLevel,
    sexualOrientation: profile.sexualOrientation,
    zodiac: zodiacFromDate(profile.user.birthDate),
    kids: profile.kids,
    communicationStyle: profile.communicationStyle,
    loveStyle: profile.loveStyle,
    heightCm: profile.heightCm,
    languages: profile.languages,
    relationshipIntention: profile.relationshipIntention,
    lifestyle: {
      drinking: profile.drinking,
      smoking: profile.smoking,
      exercise: profile.exercise,
      pets: profile.pets,
      socialMedia: profile.socialMedia,
    },
    interests: profile.user.interests.map(({ interest }) => ({
      slug: interest.slug,
      name: interest.name,
    })),
    photos: profile.smartPhotos ? rotate(photos, new Date().getUTCDate()) : photos,
    verified: profile.verificationStatus === 'VERIFIED',
  };
}

import type { UserPhoto } from '@dating/database';
import type { PhotoDto, PhotoUrlsDto } from '@dating/types';
import type { PhotoVariantName } from './image-pipeline';

export type StoredVariants = Record<PhotoVariantName, { key: string; width: number; height: number }>;

export function isStoredVariants(value: unknown): value is StoredVariants {
  if (typeof value !== 'object' || value === null) return false;
  return ['thumb', 'medium', 'large'].every((name) => {
    const variant = (value as Record<string, unknown>)[name];
    return (
      typeof variant === 'object' &&
      variant !== null &&
      typeof (variant as { key?: unknown }).key === 'string'
    );
  });
}

export function variantUrls(
  photo: Pick<UserPhoto, 'variants'>,
  publicUrl: (key: string) => string,
): PhotoUrlsDto | null {
  if (!isStoredVariants(photo.variants)) return null;
  return {
    thumb: publicUrl(photo.variants.thumb.key),
    medium: publicUrl(photo.variants.medium.key),
    large: publicUrl(photo.variants.large.key),
  };
}

/** Sahibine dönen DTO; moderationScore gibi iç alanlar dahil edilmez. */
export function toPhotoDto(photo: UserPhoto, publicUrl: (key: string) => string): PhotoDto {
  return {
    id: photo.id,
    position: photo.position,
    status: photo.status,
    contentType: photo.contentType,
    urls: variantUrls(photo, publicUrl),
    width: photo.width,
    height: photo.height,
    rejectReason: photo.status === 'REJECTED' ? photo.rejectReason : null,
  };
}

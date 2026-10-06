import sharp from 'sharp';

export const PHOTO_VARIANTS = {
  thumb: 320,
  medium: 720,
  large: 1280,
} as const;

export type PhotoVariantName = keyof typeof PHOTO_VARIANTS;

export interface ProcessedVariant {
  name: PhotoVariantName;
  buffer: Buffer;
  width: number;
  height: number;
}

export interface ProcessedImage {
  width: number;
  height: number;
  variants: ProcessedVariant[];
}

export class InvalidImageError extends Error {}

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MIN_DIMENSION = 200;
const MAX_INPUT_PIXELS = 50_000_000;

/**
 * Dosya içeriğinden (magic bytes) gerçek formatı doğrular, EXIF yönünü uygular,
 * tüm metadata'yı (EXIF/GPS dahil) atar ve WebP varyantları üretir.
 */
async function loadValidated(
  input: Buffer,
  minDimension: number,
): Promise<{ base: sharp.Sharp; width: number; height: number }> {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new InvalidImageError('Dosya geçerli bir görsel değil.');
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new InvalidImageError('Desteklenmeyen görsel formatı.');
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new InvalidImageError('Animasyonlu görseller desteklenmiyor.');
  }

  const base = sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).rotate();
  const { info: oriented } = await base.clone().toBuffer({ resolveWithObject: true });
  if (oriented.width < minDimension || oriented.height < minDimension) {
    throw new InvalidImageError(`Fotoğraf en az ${minDimension}x${minDimension} piksel olmalı.`);
  }
  return { base, width: oriented.width, height: oriented.height };
}

const CHAT_IMAGE_SIZE = 1280;
const CHAT_MIN_DIMENSION = 32;

/** Sohbet görselleri: aynı doğrulama ve metadata temizliği, tek WebP çıktısı. */
export async function processChatImage(input: Buffer): Promise<ProcessedVariant> {
  const { base } = await loadValidated(input, CHAT_MIN_DIMENSION);
  const { data, info } = await base
    .resize({ width: CHAT_IMAGE_SIZE, height: CHAT_IMAGE_SIZE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { name: 'large', buffer: data, width: info.width, height: info.height };
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const { base, width, height } = await loadValidated(input, MIN_DIMENSION);
  const oriented = { width, height };

  const variants = await Promise.all(
    (Object.entries(PHOTO_VARIANTS) as Array<[PhotoVariantName, number]>).map(
      async ([name, size]) => {
        const { data, info } = await base
          .clone()
          .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true });
        return { name, buffer: data, width: info.width, height: info.height };
      },
    ),
  );

  return { width: oriented.width, height: oriented.height, variants };
}

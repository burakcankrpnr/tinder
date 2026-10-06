import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { InvalidImageError, PHOTO_VARIANTS, processImage } from './image-pipeline';

function solidImage(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 185, g: 155, b: 251 } } });
}

describe('processImage', () => {
  it('produces WebP variants and strips EXIF metadata', async () => {
    const input = await solidImage(1600, 1200)
      .withExif({ IFD0: { Copyright: 'secret-owner', Software: 'camera-app' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const result = await processImage(input);

    expect(result).toMatchObject({ width: 1600, height: 1200 });
    expect(result.variants.map((variant) => variant.name)).toEqual(Object.keys(PHOTO_VARIANTS));
    for (const variant of result.variants) {
      const metadata = await sharp(variant.buffer).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(Math.max(variant.width, variant.height)).toBe(PHOTO_VARIANTS[variant.name]);
    }
  });

  it('applies EXIF orientation before resizing', async () => {
    const input = await solidImage(800, 400).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const result = await processImage(input);
    expect(result).toMatchObject({ width: 400, height: 800 });
  });

  it('never enlarges small images', async () => {
    const input = await solidImage(300, 300).png().toBuffer();
    const result = await processImage(input);
    for (const variant of result.variants) expect(variant.width).toBeLessThanOrEqual(300);
  });

  it('rejects files that are not images', async () => {
    await expect(processImage(Buffer.from('definitely not an image'))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });

  it('rejects unsupported formats even when they decode', async () => {
    const gif = await solidImage(400, 400).gif().toBuffer();
    await expect(processImage(gif)).rejects.toThrow('Desteklenmeyen görsel formatı.');
  });

  it('rejects images that are too small', async () => {
    const tiny = await solidImage(150, 400).png().toBuffer();
    await expect(processImage(tiny)).rejects.toBeInstanceOf(InvalidImageError);
  });
});

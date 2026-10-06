import { z } from 'zod';

export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_CONTENT_TYPES = ['video/mp4', 'video/quicktime'] as const;
export const MEDIA_CONTENT_TYPES = [...PHOTO_CONTENT_TYPES, ...VIDEO_CONTENT_TYPES] as const;

export const MAX_PHOTOS = 9;
export const MAX_VIDEO_SECONDS = 15;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 32 * 1024 * 1024;

export const photoUploadRequestSchema = z
  .object({
    contentType: z.enum(MEDIA_CONTENT_TYPES, {
      message: 'Fotoğraf veya video seçin.',
    }),
    size: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    const video = value.contentType.startsWith('video/');
    const max = video ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (value.size > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['size'],
        message: video ? 'Video en fazla 15 saniye olabilir.' : 'Bu fotoğraf çok büyük. Daha küçük bir tane seçin.',
      });
    }
  });

export const photoOrderSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(MAX_PHOTOS)
    .refine((ids) => new Set(ids).size === ids.length, 'Aynı fotoğraf iki kez gönderilemez.'),
});

export const idParamSchema = z.object({ id: z.uuid() });

export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];
export type MediaContentType = (typeof MEDIA_CONTENT_TYPES)[number];
export type PhotoUploadRequestInput = z.infer<typeof photoUploadRequestSchema>;
export type PhotoOrderInput = z.infer<typeof photoOrderSchema>;

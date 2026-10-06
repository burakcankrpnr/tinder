import { z } from 'zod';

export const MEDIA_KINDS = ['movie', 'show', 'game', 'team', 'song', 'artist'] as const;

export const mediaSearchSchema = z.object({
  kind: z.enum(MEDIA_KINDS),
  q: z.string().trim().max(80).optional().default(''),
});

export type MediaSearchInput = z.infer<typeof mediaSearchSchema>;

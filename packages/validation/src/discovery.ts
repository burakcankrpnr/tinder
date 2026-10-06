import { z } from 'zod';

export const SWIPE_ACTIONS = ['LIKE', 'PASS', 'SUPER_LIKE'] as const;
export const MAX_DISCOVERY_BATCH = 20;
export const MAX_DISCOVERY_EXCLUDE = 50;

export const discoveryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_DISCOVERY_BATCH).default(10),
  /** İstemcinin kuyruğunda zaten bekleyen kartlar (virgülle ayrılmış id'ler). */
  exclude: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').filter(Boolean) : []))
    .pipe(z.array(z.uuid()).max(MAX_DISCOVERY_EXCLUDE)),
});

export const swipeSchema = z.object({
  targetUserId: z.uuid(),
  action: z.enum(SWIPE_ACTIONS),
});

export type DiscoveryQueryInput = z.infer<typeof discoveryQuerySchema>;
export type SwipeInput = z.infer<typeof swipeSchema>;

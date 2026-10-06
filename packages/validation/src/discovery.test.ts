import { describe, expect, it } from 'vitest';
import { discoveryQuerySchema, swipeSchema } from './discovery';

const ID = '7b2f6c1e-3d4a-4b5c-8d9e-0f1a2b3c4d5e';

describe('discoveryQuerySchema', () => {
  it('defaults the limit and parses excluded ids', () => {
    expect(discoveryQuerySchema.parse({})).toEqual({ limit: 10, exclude: [] });
    expect(discoveryQuerySchema.parse({ limit: '5', exclude: `${ID},` })).toEqual({ limit: 5, exclude: [ID] });
  });

  it('rejects oversized batches and malformed ids', () => {
    expect(discoveryQuerySchema.safeParse({ limit: '50' }).success).toBe(false);
    expect(discoveryQuerySchema.safeParse({ exclude: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('swipeSchema', () => {
  it('accepts known actions only', () => {
    expect(swipeSchema.safeParse({ targetUserId: ID, action: 'LIKE' }).success).toBe(true);
    expect(swipeSchema.safeParse({ targetUserId: ID, action: 'MAYBE' }).success).toBe(false);
    expect(swipeSchema.safeParse({ targetUserId: 'x', action: 'PASS' }).success).toBe(false);
  });
});

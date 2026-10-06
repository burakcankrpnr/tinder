import { describe, expect, it } from 'vitest';
import {
  NoopModerationProvider,
  REJECT_THRESHOLD,
  REVIEW_THRESHOLD,
  decideModeration,
} from './moderation.provider';

describe('decideModeration', () => {
  it('approves low risk scores', () => {
    expect(decideModeration(0)).toBe('APPROVED');
    expect(decideModeration(REVIEW_THRESHOLD - 0.01)).toBe('APPROVED');
  });

  it('sends medium risk to manual review', () => {
    expect(decideModeration(REVIEW_THRESHOLD)).toBe('PENDING_REVIEW');
    expect(decideModeration(REJECT_THRESHOLD - 0.01)).toBe('PENDING_REVIEW');
  });

  it('rejects high risk scores', () => {
    expect(decideModeration(REJECT_THRESHOLD)).toBe('REJECTED');
    expect(decideModeration(1)).toBe('REJECTED');
  });
});

describe('NoopModerationProvider', () => {
  it('approves everything until a real provider is configured', async () => {
    const result = await new NoopModerationProvider().assess();
    expect(decideModeration(result.score)).toBe('APPROVED');
  });
});

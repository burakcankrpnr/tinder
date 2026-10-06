import { describe, expect, it } from 'vitest';
import { describeDevice } from './request-meta';

describe('describeDevice', () => {
  it('detects Chrome on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
    expect(describeDevice(ua)).toBe('Chrome / Windows');
  });

  it('detects Safari on iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    expect(describeDevice(ua)).toBe('Safari / iOS');
  });

  it('returns null for unknown agents', () => {
    expect(describeDevice('curl/8.0')).toBeNull();
    expect(describeDevice(null)).toBeNull();
  });
});

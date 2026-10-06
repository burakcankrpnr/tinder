import { describe, expect, it } from 'vitest';
import { SIGNATURE_TOLERANCE_SECONDS, signPayload, verifySignature } from './webhook-signature';

const SECRET = 'a-very-long-webhook-secret-for-tests';
const PAYLOAD = JSON.stringify({ id: 'evt_1', type: 'checkout.canceled', data: { checkoutId: 'cs_1' } });

describe('webhook signature', () => {
  it('accepts a fresh signature over the exact payload', () => {
    const now = Date.now();
    const header = signPayload(SECRET, PAYLOAD, Math.floor(now / 1000));
    expect(verifySignature(SECRET, PAYLOAD, header, now)).toBe(true);
  });

  it('rejects tampered payloads, wrong secrets and malformed headers', () => {
    const header = signPayload(SECRET, PAYLOAD);
    expect(verifySignature(SECRET, PAYLOAD.replace('cs_1', 'cs_2'), header)).toBe(false);
    expect(verifySignature('another-secret-another-secret-xx', PAYLOAD, header)).toBe(false);
    expect(verifySignature(SECRET, PAYLOAD, undefined)).toBe(false);
    expect(verifySignature(SECRET, PAYLOAD, 't=abc,v1=zz')).toBe(false);
  });

  it('rejects replays outside the tolerance window', () => {
    const now = Date.now();
    const old = Math.floor(now / 1000) - SIGNATURE_TOLERANCE_SECONDS - 1;
    expect(verifySignature(SECRET, PAYLOAD, signPayload(SECRET, PAYLOAD, old), now)).toBe(false);
  });
});

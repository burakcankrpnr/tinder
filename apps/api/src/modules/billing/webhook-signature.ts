import { createHmac, timingSafeEqual } from 'node:crypto';

/** Replay saldırılarına karşı kabul edilen en büyük saat farkı. */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function digest(secret: string, timestamp: number, payload: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
}

/** Header formatı: `t=<unix saniye>,v1=<hex hmac-sha256>` (Stripe benzeri). */
export function signPayload(secret: string, payload: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${digest(secret, timestamp, payload)}`;
}

export function verifySignature(
  secret: string,
  payload: string,
  header: string | undefined,
  now = Date.now(),
): boolean {
  if (!header) return false;
  const parts = new Map(
    header.split(',').map((part) => {
      const index = part.indexOf('=');
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()] as const;
    }),
  );
  const timestamp = Number(parts.get('t'));
  const signature = parts.get('v1');
  if (!Number.isInteger(timestamp) || !signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
  if (Math.abs(now / 1000 - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(digest(secret, timestamp, payload), 'hex');
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

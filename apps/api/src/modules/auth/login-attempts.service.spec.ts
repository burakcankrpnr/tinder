import type { Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';
import { LoginAttemptsService, MAX_FAILED_LOGINS } from './login-attempts.service';

function createFakeRedis(): Redis {
  const store = new Map<string, number>();
  const fake = {
    get: async (key: string) => (store.has(key) ? String(store.get(key)) : null),
    del: async (key: string) => (store.delete(key) ? 1 : 0),
    multi: () => {
      const ops: Array<() => [null, number]> = [];
      const chain = {
        incr: (key: string) => {
          ops.push(() => {
            const next = (store.get(key) ?? 0) + 1;
            store.set(key, next);
            return [null, next];
          });
          return chain;
        },
        expire: () => {
          ops.push(() => [null, 1]);
          return chain;
        },
        exec: async () => ops.map((op) => op()),
      };
      return chain;
    },
  };
  return fake as unknown as Redis;
}

describe('LoginAttemptsService', () => {
  it('locks after the maximum number of failures and unlocks on reset', async () => {
    const service = new LoginAttemptsService(createFakeRedis());
    const email = 'user@example.com';

    for (let attempt = 1; attempt < MAX_FAILED_LOGINS; attempt += 1) {
      await service.recordFailure(email);
      await expect(service.isLocked(email)).resolves.toBe(false);
    }

    await expect(service.recordFailure(email)).resolves.toBe(MAX_FAILED_LOGINS);
    await expect(service.isLocked(email)).resolves.toBe(true);

    await service.reset(email);
    await expect(service.isLocked(email)).resolves.toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id and verifies the original password', async () => {
    const hash = await service.hash('correct-horse-1');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hash, 'correct-horse-1')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong-horse-1')).resolves.toBe(false);
  });

  it('returns false instead of throwing for a malformed hash', async () => {
    await expect(service.verify('not-a-hash', 'anything')).resolves.toBe(false);
  });

  it('always fails dummy verification', async () => {
    await expect(service.verifyAgainstDummy('dummy-password-for-timing-1')).resolves.toBe(false);
  });
});

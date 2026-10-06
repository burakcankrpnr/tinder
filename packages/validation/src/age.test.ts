import { describe, expect, it } from 'vitest';
import { calculateAge, isAllowedAge } from './age';
import { registerSchema } from './auth';

const now = new Date('2026-10-06T12:00:00.000Z');

describe('calculateAge', () => {
  it('counts a birthday that already happened this year', () => {
    expect(calculateAge(new Date('2000-10-06T00:00:00.000Z'), now)).toBe(26);
  });

  it('does not count a birthday later this year', () => {
    expect(calculateAge(new Date('2000-10-07T00:00:00.000Z'), now)).toBe(25);
  });
});

describe('isAllowedAge', () => {
  it('accepts someone turning 18 today', () => {
    expect(isAllowedAge(new Date('2008-10-06T00:00:00.000Z'), now)).toBe(true);
  });

  it('rejects someone turning 18 tomorrow', () => {
    expect(isAllowedAge(new Date('2008-10-07T00:00:00.000Z'), now)).toBe(false);
  });
});

describe('registerSchema', () => {
  it('normalizes email and parses birth date', () => {
    const result = registerSchema.parse({
      email: '  Test@Example.COM ',
      password: 'secret-pass-1',
      birthDate: '1995-05-20',
    });
    expect(result.email).toBe('test@example.com');
    expect(result.birthDate.toISOString()).toBe('1995-05-20T00:00:00.000Z');
  });

  it('rejects underage users', () => {
    const result = registerSchema.safeParse({
      email: 'kid@example.com',
      password: 'secret-pass-1',
      birthDate: '2015-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects weak passwords', () => {
    const result = registerSchema.safeParse({
      email: 'a@example.com',
      password: 'short',
      birthDate: '1995-05-20',
    });
    expect(result.success).toBe(false);
  });
});

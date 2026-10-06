import { describe, expect, it } from 'vitest';
import { addMonths, dayKey, monthWindow, nextDayReset, periodEnd, weekWindow, yearlySavingsPercent } from './periods';

describe('billing periods (Europe/Istanbul, UTC+3)', () => {
  it('rolls the day over at local midnight', () => {
    expect(dayKey(new Date('2026-10-06T20:59:59Z'))).toBe('2026-10-06');
    expect(dayKey(new Date('2026-10-06T21:00:00Z'))).toBe('2026-10-07');
    expect(nextDayReset(new Date('2026-10-06T10:00:00Z')).toISOString()).toBe('2026-10-06T21:00:00.000Z');
  });

  it('starts weeks on Monday local time', () => {
    const week = weekWindow(new Date('2026-10-08T12:00:00Z'));
    expect(week.key).toBe('2026-10-05');
    expect(week.start.toISOString()).toBe('2026-10-04T21:00:00.000Z');
    expect(week.end.toISOString()).toBe('2026-10-11T21:00:00.000Z');
    expect(weekWindow(new Date('2026-10-04T21:30:00Z')).key).toBe('2026-10-05');
  });

  it('computes calendar months and clamps month ends', () => {
    expect(addMonths(new Date('2026-01-31T10:00:00Z'), 1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(periodEnd(new Date('2026-10-06T10:00:00Z'), 'YEARLY').toISOString()).toBe('2027-10-06T10:00:00.000Z');
    expect(monthWindow(new Date('2026-10-31T22:00:00Z'))).toEqual({
      key: '2026-11',
      end: new Date('2026-11-30T21:00:00.000Z'),
    });
  });

  it('calculates yearly savings', () => {
    expect(yearlySavingsPercent(14999, 107999)).toBe(40);
    expect(yearlySavingsPercent(0, 0)).toBe(0);
  });
});

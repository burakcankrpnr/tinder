import type { BillingInterval } from '@dating/types';

/** Türkiye 2016'dan beri sabit UTC+3 (yaz saati yok); günlük/haftalık limitler bu saatle sıfırlanır. */
const BILLING_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function shifted(now: Date): Date {
  return new Date(now.getTime() + BILLING_UTC_OFFSET_MS);
}

function startOfLocalDay(now: Date): number {
  const local = shifted(now);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - BILLING_UTC_OFFSET_MS;
}

/** Günlük limit anahtarı, ör. 2026-10-06 (yerel gün). */
export function dayKey(now: Date): string {
  return shifted(now).toISOString().slice(0, 10);
}

export function nextDayReset(now: Date): Date {
  return new Date(startOfLocalDay(now) + DAY_MS);
}

/** Haftalık Super Like dönemi: yerel saatle Pazartesi 00:00 - Pazartesi 00:00. */
export function weekWindow(now: Date): { key: string; start: Date; end: Date } {
  const dayStart = startOfLocalDay(now);
  const weekday = (shifted(now).getUTCDay() + 6) % 7;
  const start = new Date(dayStart - weekday * DAY_MS);
  return { key: dayKey(start), start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

/** Takvim ayı (yerel saat): Free plan'ın aylık Boost hakkı için. */
export function monthWindow(now: Date): { key: string; end: Date } {
  const local = shifted(now);
  const end = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - BILLING_UTC_OFFSET_MS;
  return { key: dayKey(now).slice(0, 7), end: new Date(end) };
}

/** Takvim ayı ekler; ay sonu taşmasını son güne sabitler (31 Ocak + 1 ay = 28/29 Şubat). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function periodEnd(start: Date, interval: BillingInterval): Date {
  return addMonths(start, interval === 'MONTHLY' ? 1 : 12);
}

export function yearlySavingsPercent(monthlyPrice: number, yearlyPrice: number): number {
  if (monthlyPrice <= 0) return 0;
  return Math.max(0, Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100));
}

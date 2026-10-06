const timeFormat = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });
const dayYearFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const weekdayFormat = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' });
const relative = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** Sohbet tarih ayırıcıları: Bugün, Dün, haftanın günü veya tarih. */
export function formatDayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (diffDays === 0) return 'Bugün';
  if (diffDays === 1) return 'Dün';
  if (diffDays < 7) return weekdayFormat.format(date);
  return date.getFullYear() === now.getFullYear() ? dayFormat.format(date) : dayYearFormat.format(date);
}

/** Liste önizlemeleri: bugünse saat, değilse kısa tarih. */
export function formatListTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  return startOfDay(date) === startOfDay(now) ? formatTime(iso) : formatDayLabel(iso, now);
}

export function formatRelative(iso: string, now = new Date()): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return 'az önce';
  if (abs < 3600) return relative.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(diffSeconds / 3600), 'hour');
  return relative.format(Math.round(diffSeconds / 86_400), 'day');
}

export function formatDate(iso: string): string {
  return dayYearFormat.format(new Date(iso));
}

export function isSameDay(a: string, b: string): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

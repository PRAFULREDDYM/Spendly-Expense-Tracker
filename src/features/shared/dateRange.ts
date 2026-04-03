import type { DateRange } from '../../types';

export type DateRangePreset = 'thisWeek' | 'last7Days' | 'thisMonth' | 'last30Days' | 'custom';

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function cloneDate(date: Date) {
  return new Date(date.getTime());
}

export function toIsoDate(date: Date) {
  return date.toISOString();
}

export function normalizeDateRange(range?: Partial<DateRange> | null, fallback: Date = new Date()): DateRange {
  if (range?.start && range?.end) {
    return { start: range.start, end: range.end };
  }

  const end = endOfDay(fallback);
  const start = startOfDay(cloneDate(fallback));
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function getPresetDateRange(preset: DateRangePreset, now: Date = new Date()): DateRange {
  const base = cloneDate(now);
  if (preset === 'thisMonth') {
    const start = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0);
    return { start: toIsoDate(start), end: toIsoDate(endOfDay(base)) };
  }

  if (preset === 'last30Days') {
    const start = cloneDate(base);
    start.setDate(start.getDate() - 29);
    return { start: toIsoDate(startOfDay(start)), end: toIsoDate(endOfDay(base)) };
  }

  if (preset === 'thisWeek') {
    const day = base.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const start = cloneDate(base);
    start.setDate(start.getDate() + offset);
    return { start: toIsoDate(startOfDay(start)), end: toIsoDate(endOfDay(base)) };
  }

  if (preset === 'last7Days') {
    const start = cloneDate(base);
    start.setDate(start.getDate() - 6);
    return { start: toIsoDate(startOfDay(start)), end: toIsoDate(endOfDay(base)) };
  }

  return normalizeDateRange(null, base);
}

export function formatDateRangeLabel(range: DateRange, locale = 'en-US') {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const start = new Date(range.start).toLocaleDateString(locale, options);
  const end = new Date(range.end).toLocaleDateString(locale, options);
  return `${start} - ${end}`;
}

export function buildDateRangeSearchParams(range: DateRange, prefix = '') {
  const params = new URLSearchParams();
  const key = prefix ? `${prefix}.` : '';
  params.set(`${key}start`, range.start);
  params.set(`${key}end`, range.end);
  return params;
}

export function isDateWithinRange(date: string | Date, range: DateRange) {
  const value = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
  const start = new Date(range.start).getTime();
  const end = new Date(range.end).getTime();
  return value >= start && value <= end;
}

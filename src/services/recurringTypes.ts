import type {
  Budget,
  Category,
  CurrencyCode,
  Expense,
  ExpenseType,
  RecurrenceFrequency,
} from '../types';

export const recurringCadences = ['weekly', 'monthly'] as const;
export type RecurringCadence = (typeof recurringCadences)[number];

export type InsightSeverity = 'info' | 'success' | 'warning' | 'critical';

export type InsightKind =
  | 'recurring_due_soon'
  | 'recurring_overdue'
  | 'pattern_found'
  | 'budget_warning'
  | 'budget_over_budget'
  | 'spend_spike'
  | 'savings_rate'
  | 'reminder_missing';

export interface InsightRecord {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  message: string;
  value?: string;
  relatedIds: string[];
  createdAt: string;
}

export interface RecurringExpenseRecord {
  id: string;
  userId: string;
  sourceExpenseId: string | null;
  categoryId: string | null;
  description: string;
  amount: number;
  currency: CurrencyCode;
  type: ExpenseType;
  recurringFrequency: RecurringCadence;
  recurringInterval: number;
  nextDueDate: string;
  lastOccurrenceDate: string | null;
  lastNotifiedAt: string | null;
  patternSignature: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderRecord {
  id: string;
  userId: string;
  recurringExpenseId: string | null;
  title: string;
  body: string | null;
  remindAt: string;
  sentAt: string | null;
  dismissedAt: string | null;
  isEnabled: boolean;
  channel: 'local' | 'push' | 'email';
  createdAt: string;
  updatedAt: string;
}

export interface RecurringPatternCandidate {
  signature: string;
  categoryId: string | null;
  categoryName: string;
  description: string;
  type: ExpenseType;
  recurringFrequency: RecurringCadence;
  recurringInterval: number;
  occurrenceCount: number;
  averageAmount: number;
  amountVariance: number;
  lastOccurrenceDate: string;
  nextDueDate: string;
  confidence: number;
  sourceExpenseIds: string[];
}

export interface RecurringPatternDetectionOptions {
  now?: Date;
  minimumOccurrences?: number;
  categories?: Category[];
}

const DAY_MS = 1000 * 60 * 60 * 24;
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'bill',
  'for',
  'from',
  'in',
  'monthly',
  'on',
  'payment',
  'recurring',
  'subscription',
  'the',
  'to',
  'weekly',
  'with',
]);

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const next = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function getCategoryName(expense: Pick<Expense, 'categoryId' | 'description'> & { category?: Category | null }, categories?: Category[]) {
  return expense.category?.name
    ?? categories?.find((category) => category.id === expense.categoryId)?.name
    ?? 'Uncategorized';
}

export function createRecurringId(prefix = 'rec') {
  const cryptoObject = globalThis.crypto as Crypto | undefined;
  if (cryptoObject?.randomUUID) {
    return `${prefix}-${cryptoObject.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeRecurringFrequency(value: RecurrenceFrequency | string | null | undefined): RecurringCadence | null {
  if (value === 'weekly' || value === 'monthly') {
    return value;
  }

  return null;
}

export function normalizeRecurringInterval(value: number | string | null | undefined, fallback = 1) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return Math.max(1, Math.floor(fallback));
  }

  return Math.max(1, Math.floor(parsed));
}

export function toDateOrNull(value: Date | string | null | undefined) {
  return toDate(value);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function advanceRecurringDate(date: Date | string, cadence: RecurringCadence, interval: number) {
  const next = toDate(date) ?? new Date();
  const safeInterval = normalizeRecurringInterval(interval);
  const base = startOfDay(next);

  if (cadence === 'weekly') {
    base.setDate(base.getDate() + safeInterval * 7);
  } else {
    base.setMonth(base.getMonth() + safeInterval);
  }

  return startOfDay(base);
}

export function calculateNextDueDate(
  anchor: Date | string,
  cadence: RecurringCadence,
  interval: number,
  reference = new Date(),
) {
  const safeInterval = normalizeRecurringInterval(interval);
  let next = startOfDay(toDate(anchor) ?? reference);
  const cursor = startOfDay(reference);

  while (next <= cursor) {
    next = advanceRecurringDate(next, cadence, safeInterval);
  }

  return next.toISOString();
}

export function calculateReminderAt(nextDueDate: Date | string, leadDays = 1) {
  const due = startOfDay(toDate(nextDueDate) ?? new Date());
  due.setDate(due.getDate() - Math.max(0, Math.floor(leadDays)));
  return due.toISOString();
}

export function normalizeRecurringText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && !STOP_WORDS.has(token) && token.length > 1 && !/^\d+$/.test(token))
    .slice(0, 5)
    .join(' ');
}

export function buildRecurringPatternSignature(expense: Pick<Expense, 'categoryId' | 'description' | 'type'> & { category?: Category | null }, categories?: Category[]) {
  const categoryKey = expense.categoryId ?? expense.category?.name ?? getCategoryName(expense, categories);
  const textKey = normalizeRecurringText(expense.description);
  return `${expense.type ?? 'expense'}:${categoryKey.toLowerCase()}:${textKey || 'misc'}`;
}

function inferCadence(gaps: number[]) {
  if (!gaps.length) return null;

  const gapMedian = median(gaps);
  const cadence: RecurringCadence = gapMedian < 14 ? 'weekly' : 'monthly';
  const expectedDays = cadence === 'weekly'
    ? Math.max(7, Math.round(gapMedian / 7) * 7)
    : Math.max(30, Math.round(gapMedian / 30) * 30);
  const interval = cadence === 'weekly'
    ? Math.max(1, Math.round(expectedDays / 7))
    : Math.max(1, Math.round(expectedDays / 30));

  const meanDeviation = mean(gaps.map((gap) => Math.abs(gap - expectedDays)));
  const regularity = clamp(1 - meanDeviation / expectedDays, 0, 1);

  return { cadence, interval, regularity, expectedDays };
}

export function detectRecurringPatterns(
  expenses: Expense[],
  options: RecurringPatternDetectionOptions = {},
): RecurringPatternCandidate[] {
  const now = options.now ?? new Date();
  const minimumOccurrences = options.minimumOccurrences ?? 3;
  const groups = new Map<string, Expense[]>();

  for (const expense of expenses) {
    if (!expense.description?.trim()) {
      continue;
    }

    const signature = buildRecurringPatternSignature(expense, options.categories);
    const current = groups.get(signature);
    if (current) {
      current.push(expense);
    } else {
      groups.set(signature, [expense]);
    }
  }

  const patterns: RecurringPatternCandidate[] = [];

  for (const [signature, items] of groups.entries()) {
    if (items.length < minimumOccurrences) {
      continue;
    }

    const sorted = [...items].sort((left, right) => new Date(left.expenseDate).getTime() - new Date(right.expenseDate).getTime());
    const dates = sorted
      .map((item) => toDate(item.expenseDate))
      .filter((date): date is Date => Boolean(date));

    if (dates.length < minimumOccurrences) {
      continue;
    }

    const gaps = dates.slice(1).map((date, index) => {
      const previous = dates[index];
      return Math.max(1, Math.round((date.getTime() - previous.getTime()) / DAY_MS));
    });

    const cadence = inferCadence(gaps);
    if (!cadence) {
      continue;
    }

    const amounts = sorted.map((item) => item.amount);
    const averageAmount = mean(amounts);
    const amountVariance = standardDeviation(amounts);
    const amountConsistency = averageAmount > 0
      ? clamp(1 - amountVariance / averageAmount, 0, 1)
      : 0.5;
    const cadenceStrength = cadence.regularity;
    const occurrenceBonus = clamp((items.length - minimumOccurrences + 1) * 0.08, 0, 0.24);
    const confidence = clamp(0.28 + occurrenceBonus + cadenceStrength * 0.44 + amountConsistency * 0.18, 0, 0.98);

    if (confidence < 0.45) {
      continue;
    }

    const latest = sorted[sorted.length - 1];
    const categoryName = getCategoryName(latest, options.categories);

    patterns.push({
      signature,
      categoryId: latest.categoryId ?? null,
      categoryName,
      description: latest.description.trim(),
      type: latest.type ?? 'expense',
      recurringFrequency: cadence.cadence,
      recurringInterval: cadence.interval,
      occurrenceCount: sorted.length,
      averageAmount,
      amountVariance,
      lastOccurrenceDate: latest.expenseDate,
      nextDueDate: calculateNextDueDate(latest.expenseDate, cadence.cadence, cadence.interval, now),
      confidence,
      sourceExpenseIds: sorted.map((item) => item.id),
    });
  }

  return patterns.sort((left, right) => right.confidence - left.confidence || right.occurrenceCount - left.occurrenceCount);
}


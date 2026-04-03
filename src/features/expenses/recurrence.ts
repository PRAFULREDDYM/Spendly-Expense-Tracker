import type { Expense, RecurrenceFrequency, RecurringConfig } from '../../types';

function cloneDate(date: Date) {
  return new Date(date.getTime());
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function advanceRecurringDate(date: Date | string, frequency: RecurrenceFrequency, interval: number) {
  const next = cloneDate(typeof date === 'string' ? new Date(date) : date);
  const safeInterval = Math.max(1, Math.floor(interval || 1));

  if (frequency === 'weekly') {
    next.setDate(next.getDate() + safeInterval * 7);
  } else {
    next.setMonth(next.getMonth() + safeInterval);
  }

  return startOfDay(next);
}

export function getNextRecurringDate(config: RecurringConfig, from: Date | string = new Date()) {
  const source = typeof from === 'string' ? new Date(from) : from;
  const configuredNext = new Date(config.nextOccurrenceDate);
  if (Number.isFinite(configuredNext.getTime()) && configuredNext > source) {
    return configuredNext;
  }
  return advanceRecurringDate(source, config.frequency, config.interval);
}

export function normalizeRecurringConfig(config: RecurringConfig | null | undefined, fallbackStart?: string): RecurringConfig | null {
  if (!config) return null;
  return {
    frequency: config.frequency,
    interval: Math.max(1, Math.floor(config.interval || 1)),
    nextOccurrenceDate: config.nextOccurrenceDate || fallbackStart || new Date().toISOString(),
  };
}

export function shouldGenerateRecurringExpense(expense: Expense, now: Date = new Date()) {
  if (!expense.isRecurring || !expense.recurringConfig) return false;
  return new Date(expense.recurringConfig.nextOccurrenceDate).getTime() <= now.getTime();
}

export function generateRecurringExpense(expense: Expense, nextDate: Date | string = new Date()): Expense {
  if (!expense.recurringConfig) return expense;
  const recurringConfig = normalizeRecurringConfig(expense.recurringConfig, expense.expenseDate);
  if (!recurringConfig) return expense;

  const computedNextDate = getNextRecurringDate(recurringConfig, nextDate);
  return {
    ...expense,
    id: `${expense.id}-recurring-${computedNextDate.getTime()}`,
    expenseDate: computedNextDate.toISOString(),
    recurringConfig: {
      ...recurringConfig,
      nextOccurrenceDate: advanceRecurringDate(computedNextDate, recurringConfig.frequency, recurringConfig.interval).toISOString(),
    },
  };
}

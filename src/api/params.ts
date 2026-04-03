import type { ExpenseFilters } from '../types';

export function normalizeDateRange(range?: ExpenseFilters['range']) {
  if (!range) return undefined;

  const start = range.start?.trim();
  const end = range.end?.trim();

  if (!start && !end) return undefined;

  return {
    start: start || undefined,
    end: end || undefined,
  };
}

export function serializeExpenseFilters(filters?: ExpenseFilters) {
  if (!filters) return {};

  const range = normalizeDateRange(filters.range);
  return {
    ...filters,
    range: undefined,
    start: range?.start,
    end: range?.end,
    categoryIds: filters.categoryIds?.length ? filters.categoryIds : undefined,
  };
}

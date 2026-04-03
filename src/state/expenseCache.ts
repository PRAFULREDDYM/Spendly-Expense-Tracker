import type { QueryClient } from '@tanstack/react-query';
import type { Expense, ExpenseFilters, PaginatedExpensesResponse } from '../types';
import { queryKeys } from './queryKeys';

function normalizeText(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? '';
}

function isWithinRange(expense: Expense, filters?: ExpenseFilters) {
  const range = filters?.range;
  if (!range) return true;

  const expenseDate = new Date(expense.expenseDate).getTime();
  if (range.start && expenseDate < new Date(range.start).getTime()) return false;
  if (range.end && expenseDate > new Date(range.end).getTime()) return false;
  return true;
}

export function matchesExpenseFilters(expense: Expense, filters?: ExpenseFilters) {
  if (!filters) return true;

  if (!isWithinRange(expense, filters)) return false;

  if (filters.categoryIds?.length) {
    if (!expense.categoryId || !filters.categoryIds.includes(expense.categoryId)) return false;
  }

  if (typeof filters.minAmount === 'number' && expense.amountInPrimaryCurrency < filters.minAmount) return false;
  if (typeof filters.maxAmount === 'number' && expense.amountInPrimaryCurrency > filters.maxAmount) return false;
  if (filters.currency && expense.currency !== filters.currency) return false;
  if (filters.includeRecurring === false && expense.isRecurring) return false;

  const keyword = normalizeText(filters.keyword);
  if (keyword) {
    const haystack = [
      expense.description,
      expense.category?.name,
      expense.currency,
    ].filter(Boolean).join(' ').toLowerCase();
    if (!haystack.includes(keyword)) return false;
  }

  return true;
}

function upsertExpenseList(list: PaginatedExpensesResponse, expense: Expense, filters?: ExpenseFilters) {
  const exists = list.items.some((item) => item.id === expense.id);

  if (!matchesExpenseFilters(expense, filters)) {
    return {
      ...list,
      items: list.items.filter((item) => item.id !== expense.id),
      total: exists ? Math.max(0, list.total - 1) : list.total,
    };
  }

  const items = [expense, ...list.items.filter((item) => item.id !== expense.id)];
  return {
    ...list,
    items,
    total: exists ? list.total : list.total + 1,
  };
}

function removeExpenseFromList(list: PaginatedExpensesResponse, expenseId: string) {
  const exists = list.items.some((item) => item.id === expenseId);
  return {
    ...list,
    items: list.items.filter((item) => item.id !== expenseId),
    total: exists ? Math.max(0, list.total - 1) : list.total,
  };
}

export function updateExpenseCaches(queryClient: QueryClient, expense: Expense) {
  const existingQueries = queryClient.getQueriesData<PaginatedExpensesResponse>({ queryKey: queryKeys.expenses.listRoot });
  existingQueries.forEach(([queryKey, current]) => {
    if (!current) return;
    const filters = queryKey[2] as ExpenseFilters | undefined;
    queryClient.setQueryData(queryKey, upsertExpenseList(current, expense, filters));
  });

  queryClient.setQueryData(queryKeys.expenses.detail(expense.id), expense);
}

export function removeExpenseCaches(queryClient: QueryClient, expenseId: string) {
  const existingQueries = queryClient.getQueriesData<PaginatedExpensesResponse>({ queryKey: queryKeys.expenses.listRoot });
  existingQueries.forEach(([queryKey, current]) => {
    if (!current) return;
    queryClient.setQueryData(queryKey, removeExpenseFromList(current, expenseId));
  });

  queryClient.removeQueries({ queryKey: queryKeys.expenses.detail(expenseId), exact: true });
}

export function clearAuthedCaches(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: queryKeys.preferences, exact: true });
  queryClient.removeQueries({ queryKey: queryKeys.categories.root });
  queryClient.removeQueries({ queryKey: queryKeys.expenses.root });
  queryClient.removeQueries({ queryKey: queryKeys.budgets.root });
  queryClient.removeQueries({ queryKey: queryKeys.dashboard.root });
  queryClient.removeQueries({ queryKey: queryKeys.reports.root });
}

import type { ExpenseFilters, DateRange } from '../types';

export const queryKeys = {
  session: ['auth', 'session'] as const,
  preferences: ['preferences'] as const,
  categories: {
    root: ['categories'] as const,
    list: ['categories', 'list'] as const,
    detail: (categoryId: string) => ['categories', 'detail', categoryId] as const,
  },
  expenses: {
    root: ['expenses'] as const,
    listRoot: ['expenses', 'list'] as const,
    list: (filters?: ExpenseFilters) => ['expenses', 'list', filters ?? {}] as const,
    detail: (expenseId: string) => ['expenses', 'detail', expenseId] as const,
  },
  budgets: {
    root: ['budgets'] as const,
    list: ['budgets', 'list'] as const,
    detail: (budgetId: string) => ['budgets', 'detail', budgetId] as const,
  },
  groups: {
    root: ['groups'] as const,
    list: ['groups', 'list'] as const,
    detail: (groupId: string) => ['groups', 'detail', groupId] as const,
    expenses: (groupId: string, range?: DateRange) => ['groups', 'expenses', groupId, range ?? {}] as const,
  },
  recurring: {
    root: ['recurring'] as const,
    list: ['recurring', 'list'] as const,
    reminders: ['recurring', 'reminders'] as const,
    insights: ['recurring', 'insights'] as const,
  },
  dashboard: {
    root: ['dashboard'] as const,
    summary: ['dashboard', 'summary'] as const,
  },
  reports: {
    root: ['reports'] as const,
    summary: (range?: DateRange) => ['reports', 'summary', range ?? {}] as const,
  },
  csv: {
    expenses: (filters?: ExpenseFilters) => ['reports', 'expenses-csv', filters ?? {}] as const,
  },
} as const;

export const authedQueryRoots = [
  queryKeys.preferences,
  queryKeys.categories.root,
  queryKeys.expenses.root,
  queryKeys.budgets.root,
  queryKeys.groups.root,
  queryKeys.recurring.root,
  queryKeys.dashboard.root,
  queryKeys.reports.root,
] as const;

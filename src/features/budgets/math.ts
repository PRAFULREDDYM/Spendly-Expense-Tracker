import type { Budget, Category, CurrencyCode, Expense } from '../../types';
import { formatMoney } from '../shared/money';

export interface BudgetProgress {
  spent: number;
  budgeted: number;
  remaining: number;
  percentUsed: number;
  percentRemaining: number;
  isOverBudget: boolean;
}

export interface BudgetCardSummary {
  title: string;
  subtitle: string;
  amountLabel: string;
  progress: BudgetProgress;
  accentColor: string;
}

export function calculateBudgetProgress(budget: Budget): BudgetProgress {
  const percentUsed = budget.amount <= 0 ? 0 : Math.min(100, (budget.spent / budget.amount) * 100);
  return {
    spent: budget.spent,
    budgeted: budget.amount,
    remaining: budget.remaining,
    percentUsed,
    percentRemaining: Math.max(0, 100 - percentUsed),
    isOverBudget: budget.remaining < 0,
  };
}

export function summarizeBudget(budget: Budget, category?: Category | null, currency: CurrencyCode = budget.currency, locale = 'en-US'): BudgetCardSummary {
  const progress = calculateBudgetProgress(budget);
  return {
    title: category?.name ?? 'Overall budget',
    subtitle: budget.month,
    amountLabel: formatMoney(budget.amount, currency, locale),
    progress,
    accentColor: category?.color ?? '#4c40df',
  };
}

export function groupExpensesByCategory(expenses: Expense[]) {
  const grouped = new Map<string, { category: Category | null; total: number }>();
  for (const expense of expenses) {
    const key = expense.categoryId ?? 'uncategorized';
    const current = grouped.get(key) ?? { category: expense.category ?? null, total: 0 };
    current.total += expense.amount;
    grouped.set(key, current);
  }
  return [...grouped.entries()].map(([categoryId, value]) => ({
    categoryId: categoryId === 'uncategorized' ? null : categoryId,
    category: value.category,
    total: value.total,
  }));
}

export function summarizeBudgetUsage(budgets: Budget[]) {
  const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const totalRemaining = budgets.reduce((sum, budget) => sum + budget.remaining, 0);
  return {
    totalBudgeted,
    totalSpent,
    totalRemaining,
    percentUsed: totalBudgeted <= 0 ? 0 : Math.min(100, (totalSpent / totalBudgeted) * 100),
  };
}

export function buildBudgetStatusLabel(progress: BudgetProgress) {
  if (progress.isOverBudget) return 'Over budget';
  if (progress.percentUsed >= 90) return 'Near limit';
  return 'On track';
}

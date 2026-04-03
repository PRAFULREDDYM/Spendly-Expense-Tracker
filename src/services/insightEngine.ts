import type { Budget, DetectedPattern, Expense, InsightItem, RecurringExpense, Reminder } from '../types';
import { detectRecurringPatterns } from './recurringStore';

function today() {
  return new Date();
}

function daysBetween(left: Date, right: Date) {
  return Math.round((left.getTime() - right.getTime()) / (1000 * 60 * 60 * 24));
}

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildUpcomingBillInsights(recurringExpenses: RecurringExpense[]): InsightItem[] {
  const now = today();
  return recurringExpenses
    .filter((item) => item.active)
    .filter((item) => {
      const diff = daysBetween(new Date(`${item.nextDue}T00:00:00`), now);
      return diff >= 0 && diff <= 7;
    })
    .slice(0, 3)
    .map((item) => {
      const diff = daysBetween(new Date(`${item.nextDue}T00:00:00`), now);
      return {
        id: `upcoming-${item.id}`,
        type: 'UPCOMING_BILL',
        title: `${item.name} due ${diff === 0 ? 'today' : `in ${diff} day${diff === 1 ? '' : 's'}`}`,
        detail: `${item.currency} ${item.amount.toFixed(2)}`,
        color: 'amber',
        icon: 'clock-3',
        actionLabel: 'Log it now',
        action: {
          label: 'Log it now',
          payload: { recurringExpenseId: item.id, kind: 'log-recurring' },
        },
      };
    });
}

function buildMissedPaymentInsights(recurringExpenses: RecurringExpense[]): InsightItem[] {
  const now = today();
  return recurringExpenses
    .filter((item) => item.active)
    .filter((item) => new Date(`${item.nextDue}T00:00:00`) < now && (!item.lastPaid || item.lastPaid < item.nextDue))
    .slice(0, 3)
    .map((item) => {
      const overdue = Math.max(1, daysBetween(now, new Date(`${item.nextDue}T00:00:00`)));
      return {
        id: `missed-${item.id}`,
        type: 'MISSED_PAYMENT',
        title: `${item.name} was due ${overdue} day${overdue === 1 ? '' : 's'} ago`,
        detail: `${item.currency} ${item.amount.toFixed(2)}`,
        color: 'red',
        icon: 'triangle-alert',
        actionLabel: 'Log it',
        secondaryActionLabel: 'Skip this month',
        action: {
          label: 'Log it',
          payload: { recurringExpenseId: item.id, kind: 'log-recurring' },
        },
        secondaryAction: {
          label: 'Skip this month',
          payload: { recurringExpenseId: item.id, kind: 'skip-recurring' },
        },
      };
    });
}

function buildSpendingSpikeInsight(expenses: Expense[]): InsightItem[] {
  const now = today();
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay());
  currentWeekStart.setHours(0, 0, 0, 0);

  const currentWeekByCategory = new Map<string, number>();
  const historicalByCategory = new Map<string, number[]>();

  for (const expense of expenses) {
    if (expense.type === 'income') continue;
    const categoryName = expense.category?.name ?? 'Uncategorized';
    const expenseDate = new Date(expense.expenseDate);
    if (expenseDate >= currentWeekStart) {
      currentWeekByCategory.set(categoryName, (currentWeekByCategory.get(categoryName) ?? 0) + expense.amountInPrimaryCurrency);
    } else {
      const weekOffset = Math.floor((currentWeekStart.getTime() - expenseDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      if (weekOffset > 4) continue;
      const bucket = historicalByCategory.get(categoryName) ?? [];
      bucket[weekOffset] = (bucket[weekOffset] ?? 0) + expense.amountInPrimaryCurrency;
      historicalByCategory.set(categoryName, bucket);
    }
  }

  const spikes = Array.from(currentWeekByCategory.entries()).map(([category, total]) => {
    const history = historicalByCategory.get(category) ?? [];
    const average = history.length ? history.reduce((sum, value) => sum + value, 0) / history.length : 0;
    return { category, total, average, ratio: average > 0 ? total / average : 0 };
  }).filter((item) => item.ratio >= 2).sort((left, right) => right.ratio - left.ratio);

  if (!spikes.length) return [];
  const top = spikes[0]!;
  return [{
    id: `spike-${top.category}`,
    type: 'SPENDING_SPIKE',
    title: `You spent ${top.ratio.toFixed(1)}× more on ${top.category} this week`,
    detail: `Compared with your recent weekly average.`,
    color: 'red',
    icon: 'chart-column-big',
  }];
}

function buildSavingStreakInsight(expenses: Expense[], budgets: Budget[]): InsightItem[] {
  const weeklyBudget = budgets.find((budget) => budget.month === currentMonthKey()) ?? null;
  if (!weeklyBudget) return [];

  const now = today();
  let streak = 0;
  for (let offset = 0; offset < 3; offset += 1) {
    const end = new Date(now);
    end.setDate(now.getDate() - offset * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const total = expenses.reduce((sum, expense) => {
      if (expense.type === 'income') return sum;
      const expenseDate = new Date(expense.expenseDate);
      if (expenseDate < start || expenseDate > end) return sum;
      return sum + expense.amountInPrimaryCurrency;
    }, 0);
    if (total < weeklyBudget.amount) {
      streak += 1;
    }
  }

  if (streak < 2) return [];
  return [{
    id: 'saving-streak',
    type: 'SAVING_STREAK',
    title: `You're under budget for ${streak} weeks straight`,
    detail: 'Nice work keeping your spending steady.',
    color: 'green',
    icon: 'badge-check',
  }];
}

function buildUnusualExpenseInsight(expenses: Expense[]): InsightItem[] {
  const byCategory = new Map<string, number[]>();
  for (const expense of expenses) {
    if (expense.type === 'income') continue;
    const key = expense.category?.name ?? 'Uncategorized';
    const bucket = byCategory.get(key) ?? [];
    bucket.push(expense.amountInPrimaryCurrency);
    byCategory.set(key, bucket);
  }

  const latest = [...expenses]
    .filter((expense) => expense.type !== 'income')
    .sort((left, right) => right.expenseDate.localeCompare(left.expenseDate))[0];
  if (!latest) return [];

  const values = [...(byCategory.get(latest.category?.name ?? 'Uncategorized') ?? [])].sort((left, right) => left - right);
  if (values.length < 3) return [];
  const median = values[Math.floor(values.length / 2)] ?? 0;
  if (median <= 0 || latest.amountInPrimaryCurrency <= median * 2.5) return [];

  return [{
    id: `unusual-${latest.id}`,
    type: 'UNUSUAL_EXPENSE',
    title: `This ${latest.currency} ${latest.amount.toFixed(2)} expense looks unusual`,
    detail: `It's ${(latest.amountInPrimaryCurrency / median).toFixed(1)}× your usual spend in ${latest.category?.name ?? 'that category'}.`,
    color: 'amber',
    icon: 'scan-search',
  }];
}

function buildMonthlyForecastInsight(expenses: Expense[], budgets: Budget[]): InsightItem[] {
  const now = today();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysElapsed = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentSpend = expenses.reduce((sum, expense) => {
    if (expense.type === 'income') return sum;
    const expenseDate = new Date(expense.expenseDate);
    if (expenseDate < monthStart) return sum;
    return sum + expense.amountInPrimaryCurrency;
  }, 0);
  const forecast = (currentSpend / daysElapsed) * daysInMonth;
  const monthlyBudget = budgets
    .filter((budget) => budget.month === currentMonthKey())
    .reduce((sum, budget) => sum + budget.amount, 0);

  if (monthlyBudget <= 0) return [];
  const ratio = forecast / monthlyBudget;
  if (ratio < 0.9) return [];

  return [{
    id: 'monthly-forecast',
    type: 'MONTHLY_FORECAST',
    title: `At this rate you'll spend ${forecast.toFixed(0)} this month`,
    detail: `Budget: ${monthlyBudget.toFixed(0)}`,
    color: ratio > 1 ? 'red' : 'amber',
    icon: 'calendar-range',
  }];
}

function buildDetectedPatternInsights(patterns: DetectedPattern[]): InsightItem[] {
  return patterns.slice(0, 2).map((pattern) => ({
    id: `pattern-${pattern.name}`,
    type: 'DETECTED_PATTERN',
    title: `Looks like you pay ${pattern.name} every ${pattern.estimatedFrequency}`,
    detail: `Usually around ${pattern.estimatedAmount.toFixed(2)}.`,
    color: 'accent',
    icon: 'repeat',
    actionLabel: 'Set it up',
    action: {
      label: 'Set it up',
      payload: { kind: 'create-recurring-from-pattern', pattern },
    },
  }));
}

export function buildInsights(input: {
  expenses: Expense[];
  budgets: Budget[];
  recurringExpenses: RecurringExpense[];
  reminders: Reminder[];
}): InsightItem[] {
  const patterns = detectRecurringPatterns(input.expenses);

  return [
    ...buildUpcomingBillInsights(input.recurringExpenses),
    ...buildMissedPaymentInsights(input.recurringExpenses),
    ...buildSpendingSpikeInsight(input.expenses),
    ...buildSavingStreakInsight(input.expenses, input.budgets),
    ...buildUnusualExpenseInsight(input.expenses),
    ...buildMonthlyForecastInsight(input.expenses, input.budgets),
    ...buildDetectedPatternInsights(patterns),
  ].slice(0, 8);
}

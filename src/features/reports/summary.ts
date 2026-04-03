import type { CurrencyCode, DashboardSummary, ReportSummary } from '../../types';
import { DEFAULT_CURRENCY, formatMoney } from '../shared/money';

export interface DashboardMetricCard {
  label: string;
  value: string;
  note: string;
  tone: 'primary' | 'secondary' | 'tertiary' | 'error';
}

export interface ReportMetricCard {
  label: string;
  value: string;
  note: string;
}

export function calculateTrendDirection(trendPercent: number) {
  if (trendPercent > 0) return 'up';
  if (trendPercent < 0) return 'down';
  return 'flat';
}

export function buildDashboardMetricCards(summary: DashboardSummary, currency: CurrencyCode = DEFAULT_CURRENCY, locale = 'en-US'): DashboardMetricCard[] {
  const trendDirection = calculateTrendDirection(summary.trendPercent);
  return [
    {
      label: 'This month',
      value: formatMoney(summary.totalThisMonth, currency, locale),
      note: `${trendDirection === 'up' ? '+' : ''}${summary.trendPercent.toFixed(1)}% vs last month`,
      tone: 'primary',
    },
    {
      label: 'Daily average',
      value: formatMoney(summary.dailyAverage, currency, locale),
      note: 'Based on the selected range',
      tone: 'secondary',
    },
    {
      label: 'Top category',
      value: summary.topCategory?.name ?? 'None',
      note: formatMoney(summary.topCategorySpend, currency, locale),
      tone: 'tertiary',
    },
    {
      label: 'Budget usage',
      value: `${summary.budgetUsagePercent.toFixed(0)}%`,
      note: summary.budgetUsagePercent >= 100 ? 'Over budget' : 'Within budget',
      tone: summary.budgetUsagePercent >= 100 ? 'error' : 'secondary',
    },
  ];
}

export function buildReportMetricCards(report: ReportSummary, currency: CurrencyCode = DEFAULT_CURRENCY, locale = 'en-US'): ReportMetricCard[] {
  return [
    {
      label: 'Spent',
      value: formatMoney(report.totalSpent, currency, locale),
      note: `${report.categoryBreakdown.length} categories`,
    },
    {
      label: 'Budgeted',
      value: formatMoney(report.totalBudgeted, currency, locale),
      note: 'Selected period',
    },
    {
      label: 'Remaining',
      value: formatMoney(report.totalRemaining, currency, locale),
      note: report.totalRemaining < 0 ? 'Over budget' : 'Still available',
    },
  ];
}

export function summarizeRecentExpenses(summary: DashboardSummary, locale = 'en-US') {
  return summary.recentExpenses.map((expense) => ({
    id: expense.id,
    title: expense.description,
    category: expense.category?.name ?? 'Uncategorized',
    amount: formatMoney(expense.amount, expense.currency, locale),
    date: new Date(expense.expenseDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
  }));
}

import type { Expense } from '../types';

export const categoryColorScale = ['#4F6BFF', '#34C77B', '#F0524A', '#F5A623', '#4B9EF5', '#F472B6', '#A855F7', '#14B8A6'] as const;

export function getCategoryColor(categoryName: string) {
  let hash = 0;
  for (let index = 0; index < categoryName.length; index += 1) {
    hash = (hash * 31 + categoryName.charCodeAt(index)) >>> 0;
  }

  return categoryColorScale[hash % categoryColorScale.length];
}

export function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((item) => `${item}${item}`).join('')
    : normalized;

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getFirstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] ?? 'there';
}

export function formatPeriodDateLabel(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(date));
}

export function formatCompactDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(date));
}

export function formatHistoryDateLabel(date: string) {
  const input = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const inputKey = input.toISOString().slice(0, 10);
  const todayKey = today.toISOString().slice(0, 10);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (inputKey === todayKey) return 'Today';
  if (inputKey === yesterdayKey) return 'Yesterday';

  return new Intl.DateTimeFormat('en-US', { weekday: 'short', day: '2-digit', month: 'short' }).format(input);
}

export function groupExpensesByDate(expenses: Expense[]) {
  const grouped = new Map<string, Expense[]>();

  for (const expense of expenses) {
    const key = expense.expenseDate.slice(0, 10);
    const items = grouped.get(key);
    if (items) {
      items.push(expense);
    } else {
      grouped.set(key, [expense]);
    }
  }

  return Array.from(grouped.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([date, items]) => ({
      date,
      label: formatHistoryDateLabel(date),
      items,
      total: items.reduce((sum, expense) => sum + expense.amount, 0),
    }));
}

export function buildExpenseTrend(expenses: Expense[], totalBuckets: number) {
  const today = new Date();
  const buckets = Array.from({ length: totalBuckets }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (totalBuckets - index - 1));
    return {
      key: date.toISOString().slice(0, 10),
      label: totalBuckets > 31
        ? new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date)
        : new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
      amount: 0,
      count: 0,
    };
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const expense of expenses) {
    const key = expense.expenseDate.slice(0, 10);
    const bucket = bucketMap.get(key);
    if (bucket) {
      bucket.amount += expense.amount;
      bucket.count += 1;
    }
  }

  return buckets;
}

export function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function getMerchantIcon(description: string, categoryName?: string | null) {
  const label = `${description} ${categoryName ?? ''}`.toLowerCase();

  if (label.includes('netflix')) return { label: 'N', color: '#E50914', background: withAlpha('#E50914', 0.16) };
  if (label.includes('spotify')) return { label: 'S', color: '#1DB954', background: withAlpha('#1DB954', 0.16) };
  if (label.includes('amazon')) return { label: 'A', color: '#FF9900', background: withAlpha('#FF9900', 0.16) };
  if (label.includes('uber') || label.includes('lyft')) return { label: 'U', color: '#111111', background: withAlpha('#111111', 0.16) };
  if (label.includes('steam')) return { label: 'S', color: '#1b2838', background: withAlpha('#1b2838', 0.16) };
  if (label.includes('google')) return { label: 'G', color: '#4B9EF5', background: withAlpha('#4B9EF5', 0.16) };
  if (label.includes('apple')) return { label: 'A', color: '#3D4451', background: withAlpha('#3D4451', 0.16) };

  const fallbackColor = getCategoryColor(categoryName ?? description);
  return {
    label: (categoryName ?? description).slice(0, 1).toUpperCase(),
    color: fallbackColor,
    background: withAlpha(fallbackColor, 0.16),
  };
}

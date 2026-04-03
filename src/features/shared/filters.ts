import type { CurrencyCode, ExpenseFilters } from '../../types';
import { normalizeDateRange } from './dateRange';

export interface ExpenseFilterQuery {
  start?: string;
  end?: string;
  categoryIds?: string[];
  minAmount?: number;
  maxAmount?: number;
  keyword?: string;
  currency?: CurrencyCode;
  includeRecurring?: boolean;
  sortBy?: ExpenseFilters['sortBy'];
  sortDirection?: ExpenseFilters['sortDirection'];
  page?: number;
  pageSize?: number;
}

export function normalizeExpenseFilters(filters: ExpenseFilters = {}): Required<Omit<ExpenseFilters, 'range'>> & { range: { start: string; end: string } } {
  const range = normalizeDateRange(filters.range ?? null);
  return {
    range,
    type: filters.type ?? 'expense',
    categoryIds: filters.categoryIds ?? [],
    minAmount: filters.minAmount ?? 0,
    maxAmount: filters.maxAmount ?? Number.POSITIVE_INFINITY,
    keyword: (filters.keyword ?? '').trim(),
    currency: filters.currency,
    includeRecurring: filters.includeRecurring ?? true,
    sortBy: filters.sortBy ?? 'expenseDate',
    sortDirection: filters.sortDirection ?? 'desc',
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 20,
  };
}

export function buildExpenseQueryParams(filters: ExpenseFilters) {
  const normalized = normalizeExpenseFilters(filters);
  const params = new URLSearchParams();
  params.set('start', normalized.range.start);
  params.set('end', normalized.range.end);
  params.set('includeRecurring', String(normalized.includeRecurring));
  params.set('sortBy', normalized.sortBy);
  params.set('sortDirection', normalized.sortDirection);
  params.set('page', String(normalized.page));
  params.set('pageSize', String(normalized.pageSize));

  if (normalized.categoryIds.length) params.set('categoryIds', normalized.categoryIds.join(','));
  if (normalized.type) params.set('type', normalized.type);
  if (Number.isFinite(normalized.minAmount)) params.set('minAmount', String(normalized.minAmount));
  if (Number.isFinite(normalized.maxAmount)) params.set('maxAmount', String(normalized.maxAmount));
  if (normalized.keyword) params.set('keyword', normalized.keyword);
  if (normalized.currency) params.set('currency', normalized.currency);

  return params;
}

export function parseExpenseQueryParams(params: URLSearchParams): ExpenseFilters {
  const range = {
    start: params.get('start') ?? undefined,
    end: params.get('end') ?? undefined,
  };
  const categoryIds = params.get('categoryIds')?.split(',').filter(Boolean) ?? [];
  const minAmount = params.get('minAmount');
  const maxAmount = params.get('maxAmount');

  return {
    range,
    type: (params.get('type') as ExpenseFilters['type'] | null) ?? undefined,
    categoryIds,
    minAmount: minAmount ? Number(minAmount) : undefined,
    maxAmount: maxAmount ? Number(maxAmount) : undefined,
    keyword: params.get('keyword') ?? undefined,
    currency: (params.get('currency') as CurrencyCode | null) ?? undefined,
    includeRecurring: params.get('includeRecurring') ? params.get('includeRecurring') === 'true' : undefined,
    sortBy: (params.get('sortBy') as ExpenseFilters['sortBy'] | null) ?? undefined,
    sortDirection: (params.get('sortDirection') as ExpenseFilters['sortDirection'] | null) ?? undefined,
    page: params.get('page') ? Number(params.get('page')) : undefined,
    pageSize: params.get('pageSize') ? Number(params.get('pageSize')) : undefined,
  };
}

export function buildExpenseFilterLabel(filters: ExpenseFilters) {
  const normalized = normalizeExpenseFilters(filters);
  const parts: string[] = [];
  if (normalized.keyword) parts.push(`Keyword: ${normalized.keyword}`);
  if (normalized.categoryIds.length) parts.push(`${normalized.categoryIds.length} categories`);
  if (normalized.currency) parts.push(normalized.currency);
  parts.push(`${normalized.range.start} to ${normalized.range.end}`);
  return parts.join(' · ');
}

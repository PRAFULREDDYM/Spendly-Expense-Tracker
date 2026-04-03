import type { Budget, BudgetInput, CurrencyCode } from '../../types';
import { DEFAULT_CURRENCY, roundMoney } from '../shared/money';

export interface BudgetFormState {
  id?: string;
  categoryId: string | null;
  month: string;
  amount: string;
  currency: CurrencyCode;
}

export interface BudgetFormErrors {
  categoryId?: string;
  month?: string;
  amount?: string;
  currency?: string;
}

export function createBudgetDraft(budget?: Budget, defaults: { currency?: CurrencyCode } = {}): BudgetFormState {
  return {
    id: budget?.id,
    categoryId: budget?.categoryId ?? null,
    month: budget?.month ?? new Date().toISOString().slice(0, 7),
    amount: budget ? String(budget.amount) : '',
    currency: budget?.currency ?? defaults.currency ?? DEFAULT_CURRENCY,
  };
}

export function validateBudgetDraft(draft: BudgetFormState): BudgetFormErrors {
  const errors: BudgetFormErrors = {};
  if (!draft.month || !/^\d{4}-\d{2}$/.test(draft.month)) errors.month = 'Use YYYY-MM format.';
  if (!draft.amount || Number.isNaN(Number(draft.amount)) || Number(draft.amount) <= 0) errors.amount = 'Enter a positive budget amount.';
  if (!draft.currency) errors.currency = 'Select a currency.';
  return errors;
}

export function buildBudgetInput(draft: BudgetFormState): BudgetInput {
  return {
    categoryId: draft.categoryId,
    month: draft.month,
    amount: roundMoney(Number(draft.amount)),
    currency: draft.currency,
  };
}

export function getBudgetMonthLabel(month: string, locale = 'en-US') {
  const [year, monthPart] = month.split('-').map(Number);
  if (!year || !monthPart) return month;
  return new Date(year, monthPart - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

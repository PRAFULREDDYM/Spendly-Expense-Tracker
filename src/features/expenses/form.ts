import type { Expense, ExpenseInput, PreferencesInput, RecurringConfig, CurrencyCode } from '../../types';
import { supportedCurrencies } from '../../types';
import { DEFAULT_CURRENCY, formatMoney, roundMoney } from '../shared/money';
import { getNextRecurringDate, normalizeRecurringConfig } from './recurrence';
import type { ExpenseFormContext, ExpenseFormErrors, ExpenseFormState, ExpenseFormSubmission } from './types';

export function createEmptyExpenseDraft(context: ExpenseFormContext = { categories: [] }): ExpenseFormState {
  return {
    amount: '',
    currency: context.defaultCurrency ?? DEFAULT_CURRENCY,
    categoryId: context.categories[0]?.id ?? null,
    groupId: null,
    description: '',
    expenseDate: new Date().toISOString(),
    receiptUrl: '',
    isRecurring: false,
    recurrenceFrequency: 'monthly',
    recurrenceInterval: 1,
    nextOccurrenceDate: '',
  };
}

export function createExpenseDraftFromExpense(expense: Expense): ExpenseFormState {
  return {
    id: expense.id,
    amount: String(expense.amount),
    currency: expense.currency,
    categoryId: expense.categoryId,
    groupId: expense.groupId ?? null,
    description: expense.description,
    expenseDate: expense.expenseDate,
    receiptUrl: expense.receiptUrl ?? '',
    isRecurring: expense.isRecurring,
    recurrenceFrequency: expense.recurringConfig?.frequency ?? 'monthly',
    recurrenceInterval: expense.recurringConfig?.interval ?? 1,
    nextOccurrenceDate: expense.recurringConfig?.nextOccurrenceDate ?? '',
  };
}

export function validateExpenseDraft(draft: ExpenseFormState): ExpenseFormErrors {
  const errors: ExpenseFormErrors = {};
  if (!draft.amount || Number.isNaN(Number(draft.amount)) || Number(draft.amount) <= 0) {
    errors.amount = 'Enter a valid amount.';
  }
  if (!draft.currency) errors.currency = 'Select a currency.';
  if (!draft.description.trim()) errors.description = 'Add a description.';
  if (!draft.expenseDate) errors.expenseDate = 'Pick a date.';
  if (draft.isRecurring && (!Number.isInteger(draft.recurrenceInterval) || draft.recurrenceInterval < 1)) {
    errors.recurrenceInterval = 'Use an interval of at least 1.';
  }
  if (draft.receiptUrl && !/^https?:\/\/.+/i.test(draft.receiptUrl.trim())) {
    errors.receiptUrl = 'Receipt URL must start with http:// or https://';
  }
  return errors;
}

export function buildRecurringConfig(draft: ExpenseFormState): RecurringConfig | null {
  if (!draft.isRecurring) return null;
  return {
    frequency: draft.recurrenceFrequency,
    interval: Math.max(1, Math.floor(draft.recurrenceInterval || 1)),
    nextOccurrenceDate: draft.nextOccurrenceDate || getNextRecurringDate({
      frequency: draft.recurrenceFrequency,
      interval: draft.recurrenceInterval,
      nextOccurrenceDate: draft.expenseDate,
    }, draft.expenseDate).toISOString(),
  };
}

export function buildExpenseInput(draft: ExpenseFormState, options: { primaryCurrency?: CurrencyCode } = {}): ExpenseFormSubmission {
  const recurringConfig = buildRecurringConfig(draft);
  const input: ExpenseInput = {
    categoryId: draft.categoryId,
    groupId: draft.groupId ?? null,
    amount: roundMoney(Number(draft.amount)),
    currency: draft.currency,
    expenseDate: draft.expenseDate,
    description: draft.description.trim(),
    type: draft.type,
    receiptUrl: draft.receiptUrl.trim() || null,
    isRecurring: draft.isRecurring,
    recurringConfig,
  };

  if (options.primaryCurrency && options.primaryCurrency !== draft.currency) {
    // The backend owns exchange-rate truth; this keeps the form explicit about the chosen currency.
    void options.primaryCurrency;
  }

  return { input, recurringConfig: normalizeRecurringConfig(recurringConfig, draft.expenseDate) };
}

export function describeExpenseRecurrence(config: RecurringConfig | null) {
  if (!config) return 'One-time';
  const intervalLabel = config.interval === 1 ? '' : `${config.interval} `;
  return `${intervalLabel}${config.frequency}`;
}

export function summarizeExpense(expense: Expense, locale = 'en-US') {
  return {
    categoryLabel: expense.category?.name ?? 'Uncategorized',
    amountLabel: formatMoney(expense.amount, expense.currency, locale),
    recurrenceLabel: describeExpenseRecurrence(expense.recurringConfig),
  };
}

export function coerceExpenseCurrency(value: string, fallback: CurrencyCode = DEFAULT_CURRENCY): CurrencyCode {
  return supportedCurrencies.includes(value as CurrencyCode) ? (value as CurrencyCode) : fallback;
}

export function buildExpenseUpdateState(expense: Expense, preferences?: PreferencesInput) {
  return {
    ...createExpenseDraftFromExpense(expense),
    currency: preferences?.currency ?? expense.currency,
  };
}

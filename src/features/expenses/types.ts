import type {
  CurrencyCode,
  Expense,
  ExpenseInput,
  ExpenseType,
  RecurrenceFrequency,
  RecurringConfig,
} from '../../types';

export interface ExpenseFormState {
  id?: string;
  type?: ExpenseType;
  amount: string;
  currency: CurrencyCode;
  categoryId: string | null;
  groupId?: string | null;
  description: string;
  expenseDate: string;
  receiptUrl: string;
  isRecurring: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceInterval: number;
  nextOccurrenceDate: string;
}

export interface ExpenseFormErrors {
  amount?: string;
  currency?: string;
  categoryId?: string;
  description?: string;
  expenseDate?: string;
  receiptUrl?: string;
  recurrenceInterval?: string;
  nextOccurrenceDate?: string;
}

export interface ExpenseFormContext {
  categories: Array<{ id: string; name: string }>;
  defaultCurrency?: CurrencyCode;
  primaryCurrency?: CurrencyCode;
}

export interface ExpenseFormSubmission {
  input: ExpenseInput;
  recurringConfig: RecurringConfig | null;
}

export interface ExpenseSelectionSummary {
  expense: Expense;
  categoryLabel: string;
  amountLabel: string;
  recurrenceLabel: string;
}

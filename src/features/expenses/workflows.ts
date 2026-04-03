import type { Expense, ExpenseFilters, ExpenseInput, PaginatedExpensesResponse } from '../../types';
import { buildCsv, triggerCsvDownload } from '../shared/csv';
import { buildExpenseInput, createExpenseDraftFromExpense, describeExpenseRecurrence, summarizeExpense } from './form';
import type { ExpenseFormState } from './types';
import { formatMoney } from '../shared/money';

export interface ExpenseCrudGateway {
  list(filters: ExpenseFilters): Promise<PaginatedExpensesResponse>;
  create(input: ExpenseInput): Promise<Expense>;
  update(id: string, input: ExpenseInput): Promise<Expense>;
  remove(id: string): Promise<void>;
}

export interface ExpenseCrudResult {
  save(draft: ExpenseFormState): Promise<Expense>;
  delete(id: string): Promise<void>;
  duplicate(expense: Expense): Promise<Expense>;
  exportFilteredCsv(filters: ExpenseFilters, expenses: Expense[]): string;
}

export function sortExpensesByDate(expenses: Expense[]) {
  return [...expenses].sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());
}

export function insertExpenseSorted(expenses: Expense[], expense: Expense) {
  return sortExpensesByDate([expense, ...expenses.filter((item) => item.id !== expense.id)]);
}

export function replaceExpense(expenses: Expense[], expense: Expense) {
  return expenses.map((item) => (item.id === expense.id ? expense : item));
}

export function removeExpense(expenses: Expense[], expenseId: string) {
  return expenses.filter((item) => item.id !== expenseId);
}

export function createExpenseCrudActions(gateway: ExpenseCrudGateway): ExpenseCrudResult {
  return {
    async save(draft) {
      const submission = buildExpenseInput(draft);
      if (draft.id) {
        return gateway.update(draft.id, submission.input);
      }
      return gateway.create(submission.input);
    },
    async delete(id) {
      await gateway.remove(id);
    },
    async duplicate(expense) {
      return gateway.create({
        ...buildExpenseInput(createExpenseDraftFromExpense(expense)).input,
        expenseDate: new Date().toISOString(),
      });
    },
    exportFilteredCsv(filters, expenses) {
      const csv = buildCsv(expenses, [
        { key: 'expenseDate', header: 'Date', formatter: (value) => String(value ?? '') },
        { key: 'description', header: 'Description', formatter: (value) => String(value ?? '') },
        {
          key: 'category',
          header: 'Category',
          formatter: (_value, row) => row.category?.name ?? 'Uncategorized',
        },
        { key: 'amount', header: 'Amount', formatter: (value, row) => formatMoney(Number(value), row.currency) },
        { key: 'currency', header: 'Currency' },
        {
          key: 'recurring',
          header: 'Recurrence',
          formatter: (_value, row) => describeExpenseRecurrence(row.recurringConfig),
        },
        {
          key: 'receiptUrl',
          header: 'Receipt URL',
          formatter: (value) => String(value ?? ''),
        },
      ]);
      void filters;
      void triggerCsvDownload('expenses.csv', csv);
      return csv;
    },
  };
}

export function buildExpenseCardSummary(expense: Expense, locale = 'en-US') {
  const summary = summarizeExpense(expense, locale);
  return {
    ...summary,
    title: expense.description,
    dateLabel: new Date(expense.expenseDate).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    amountLabel: formatMoney(expense.amount, expense.currency, locale),
  };
}

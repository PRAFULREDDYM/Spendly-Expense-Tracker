import type { Expense, ExpenseInput } from '../types';
import { apiClient } from './client';

export const expensesApi = {
  create(input: ExpenseInput): Promise<Expense> {
    return apiClient.expenses.create(input);
  },
  delete(expenseId: string): Promise<void> {
    return apiClient.expenses.remove(expenseId);
  },
};

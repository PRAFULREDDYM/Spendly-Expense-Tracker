import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Budget, Expense, RecurringExpense, RecurringExpenseInput, Reminder } from '../types';
import { apiClient } from '../api';
import { buildInsights } from '../services/insightEngine';
import { queryKeys } from '../state/queryKeys';

export function useRecurringQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.recurring.list,
    queryFn: () => apiClient.recurring.list(),
    enabled,
    staleTime: 20_000,
  });
}

export function useRecurringRemindersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.recurring.reminders,
    queryFn: () => apiClient.recurring.reminders(),
    enabled,
    staleTime: 10_000,
  });
}

export function useRecurringInsightsQuery(input: {
  expenses: Expense[];
  budgets: Budget[];
  recurring: RecurringExpense[];
  reminders: Reminder[];
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['recurring', 'insights', input.expenses.length, input.budgets.length, input.recurring.length, input.reminders.length] as const,
    queryFn: () => Promise.resolve(buildInsights({
      expenses: input.expenses,
      budgets: input.budgets,
      recurringExpenses: input.recurring,
      reminders: input.reminders,
    })),
    enabled: input.enabled ?? true,
    staleTime: 5_000,
  });
}

export function useRecurringMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.recurring.root });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root });
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.root });
  };

  return {
    createRecurringMutation: useMutation({
      mutationFn: (input: RecurringExpenseInput) => apiClient.recurring.create(input),
      onSuccess: invalidate,
    }),
    updateRecurringMutation: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<RecurringExpenseInput> }) => apiClient.recurring.update(id, input),
      onSuccess: invalidate,
    }),
    deleteRecurringMutation: useMutation({
      mutationFn: (id: string) => apiClient.recurring.remove(id),
      onSuccess: invalidate,
    }),
    dismissReminderMutation: useMutation({
      mutationFn: (id: string) => apiClient.recurring.dismissReminder(id),
      onSuccess: invalidate,
    }),
    logReminderMutation: useMutation({
      mutationFn: ({ id, amount }: { id: string; amount?: number }) => apiClient.recurring.logReminder(id, amount),
      onSuccess: invalidate,
    }),
  };
}

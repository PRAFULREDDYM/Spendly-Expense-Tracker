import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { Budget, BudgetInput } from '../types';
import { apiClient } from '../api';
import { queryKeys } from '../state/queryKeys';

type BudgetsQueryOptions = Omit<UseQueryOptions<Budget[], Error>, 'queryKey' | 'queryFn'>;

export function useBudgetsQuery(options?: BudgetsQueryOptions) {
  return useQuery<Budget[]>({
    queryKey: queryKeys.budgets.list,
    queryFn: () => apiClient.budgets.list(),
    staleTime: 30_000,
    ...options,
  });
}

export function useCreateBudgetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BudgetInput) => apiClient.budgets.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.root });
    },
  });
}

export function useUpdateBudgetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ budgetId, input }: { budgetId: string; input: Partial<BudgetInput> }) =>
      apiClient.budgets.update(budgetId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.root });
    },
  });
}

export function useDeleteBudgetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (budgetId: string) => apiClient.budgets.remove(budgetId).then(() => budgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.root });
    },
  });
}

export function useBudgetMutations() {
  return {
    createBudgetMutation: useCreateBudgetMutation(),
    updateBudgetMutation: useUpdateBudgetMutation(),
    deleteBudgetMutation: useDeleteBudgetMutation(),
  };
}

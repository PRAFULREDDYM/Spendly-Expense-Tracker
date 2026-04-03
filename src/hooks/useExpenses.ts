import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import type { Expense, ExpenseFilters, ExpenseInput, PaginatedExpensesResponse } from '../types';
import { apiClient } from '../api';
import { queryKeys } from '../state/queryKeys';
import { removeExpenseCaches, updateExpenseCaches } from '../state/expenseCache';

type ExpenseListQueryOptions = Omit<UseQueryOptions<PaginatedExpensesResponse, Error>, 'queryKey' | 'queryFn'>;
type ExpenseDetailQueryOptions = Omit<UseQueryOptions<Expense, Error>, 'queryKey' | 'queryFn'>;
type ExpenseMutationInput = Partial<ExpenseInput>;

function buildOptimisticExpense(input: ExpenseInput | Partial<ExpenseInput>, expenseId: string): Expense {
  const now = new Date().toISOString();
  const amount = Number(input.amount ?? 0);

  return {
    id: expenseId,
    userId: '',
    categoryId: input.categoryId ?? null,
    amount,
    currency: input.currency ?? 'USD',
    amountInPrimaryCurrency: amount,
    expenseDate: input.expenseDate ?? now,
    description: input.description ?? '',
    category: null,
    receiptUrl: input.receiptUrl ?? null,
    isRecurring: input.isRecurring ?? false,
    recurringConfig: input.recurringConfig ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function restoreListSnapshots(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshots: Array<[readonly unknown[], PaginatedExpensesResponse | undefined]>,
) {
  snapshots.forEach(([queryKey, data]) => {
    if (data) {
      queryClient.setQueryData(queryKey, data);
    }
  });
}

function invalidateExpenseRelatedQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root });
  queryClient.invalidateQueries({ queryKey: queryKeys.budgets.root });
  queryClient.invalidateQueries({ queryKey: queryKeys.reports.root });
  queryClient.invalidateQueries({ queryKey: queryKeys.expenses.root });
}

export function useExpensesQuery(filters?: ExpenseFilters, options?: ExpenseListQueryOptions) {
  return useQuery({
    queryKey: queryKeys.expenses.list(filters),
    queryFn: () => apiClient.expenses.list(filters),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
    ...options,
  });
}

export function useExpenseQuery(expenseId?: string, options?: ExpenseDetailQueryOptions) {
  return useQuery({
    queryKey: expenseId ? queryKeys.expenses.detail(expenseId) : ['expenses', 'detail', 'disabled'] as const,
    queryFn: () => apiClient.expenses.get(expenseId as string),
    enabled: Boolean(expenseId),
    staleTime: 30_000,
    ...options,
  });
}

export function useCreateExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ExpenseInput) => apiClient.expenses.create(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.expenses.root });
      const snapshots = queryClient.getQueriesData<PaginatedExpensesResponse>({ queryKey: queryKeys.expenses.listRoot });
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticExpense = buildOptimisticExpense(input, optimisticId);
      updateExpenseCaches(queryClient, optimisticExpense);
      return { snapshots, optimisticId };
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      restoreListSnapshots(queryClient, context.snapshots);
      queryClient.removeQueries({ queryKey: queryKeys.expenses.detail(context.optimisticId), exact: true });
    },
    onSuccess: (expense, _input, context) => {
      if (context) {
        queryClient.removeQueries({ queryKey: queryKeys.expenses.detail(context.optimisticId), exact: true });
      }
      updateExpenseCaches(queryClient, expense);
      invalidateExpenseRelatedQueries(queryClient);
    },
  });
}

export function useUpdateExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ expenseId, input }: { expenseId: string; input: ExpenseMutationInput }) =>
      apiClient.expenses.update(expenseId, input),
    onMutate: async ({ expenseId, input }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.expenses.root });
      const snapshots = queryClient.getQueriesData<PaginatedExpensesResponse>({ queryKey: queryKeys.expenses.listRoot });
      const previousDetail = queryClient.getQueryData<Expense>(queryKeys.expenses.detail(expenseId));
      const optimisticExpense = buildOptimisticExpense({ ...(previousDetail ?? {}), ...input }, expenseId);
      updateExpenseCaches(queryClient, optimisticExpense);
      return { snapshots, expenseId, previousDetail };
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      restoreListSnapshots(queryClient, context.snapshots);
      if (context.previousDetail) {
        queryClient.setQueryData(queryKeys.expenses.detail(context.expenseId), context.previousDetail);
      }
    },
    onSuccess: (expense) => {
      updateExpenseCaches(queryClient, expense);
      invalidateExpenseRelatedQueries(queryClient);
    },
  });
}

export function useDeleteExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expenseId: string) => apiClient.expenses.remove(expenseId).then(() => expenseId),
    onMutate: async (expenseId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.expenses.root });
      const snapshots = queryClient.getQueriesData<PaginatedExpensesResponse>({ queryKey: queryKeys.expenses.listRoot });
      const previousDetail = queryClient.getQueryData<Expense>(queryKeys.expenses.detail(expenseId));
      removeExpenseCaches(queryClient, expenseId);
      return { snapshots, expenseId, previousDetail };
    },
    onError: (_error, _expenseId, context) => {
      if (!context) return;
      restoreListSnapshots(queryClient, context.snapshots);
      if (context.previousDetail) {
        queryClient.setQueryData(queryKeys.expenses.detail(context.expenseId), context.previousDetail);
      }
    },
    onSuccess: () => {
      invalidateExpenseRelatedQueries(queryClient);
    },
  });
}

export function useExpenseMutations() {
  return {
    createExpenseMutation: useCreateExpenseMutation(),
    updateExpenseMutation: useUpdateExpenseMutation(),
    deleteExpenseMutation: useDeleteExpenseMutation(),
  };
}

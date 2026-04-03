import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { Category, CategoryInput } from '../types';
import { apiClient } from '../api';
import { queryKeys } from '../state/queryKeys';

type CategoriesQueryOptions = Omit<UseQueryOptions<Category[], Error>, 'queryKey' | 'queryFn'>;

export function useCategoriesQuery(options?: CategoriesQueryOptions) {
  return useQuery<Category[]>({
    queryKey: queryKeys.categories.list,
    queryFn: () => apiClient.categories.list(),
    staleTime: 60_000,
    ...options,
  });
}

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CategoryInput) => apiClient.categories.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.preferences });
    },
  });
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, input }: { categoryId: string; input: Partial<CategoryInput> }) =>
      apiClient.categories.update(categoryId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.preferences });
    },
  });
}

export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => apiClient.categories.remove(categoryId).then(() => categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.preferences });
    },
  });
}

export function useCategoryMutations() {
  return {
    createCategoryMutation: useCreateCategoryMutation(),
    updateCategoryMutation: useUpdateCategoryMutation(),
    deleteCategoryMutation: useDeleteCategoryMutation(),
  };
}

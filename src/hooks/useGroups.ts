import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GroupBudgetInput } from '../types';
import { apiClient } from '../api';
import { queryKeys } from '../state/queryKeys';

export function useGroupsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.groups.list,
    queryFn: () => apiClient.groups.list(),
    enabled,
    staleTime: 20_000,
  });
}

export function useGroupExpensesQuery(groupId?: string, start?: string, end?: string, enabled = true) {
  return useQuery({
    queryKey: groupId ? queryKeys.groups.expenses(groupId, { start: start ?? '', end: end ?? '' }) : ['groups', 'expenses', 'disabled'] as const,
    queryFn: () => apiClient.groups.expenses(groupId as string, start as string, end as string),
    enabled: Boolean(groupId && start && end && enabled),
    staleTime: 15_000,
  });
}

export function useGroupMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.root });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root });
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.root });
  };

  return {
    createGroupMutation: useMutation({
      mutationFn: (name: string) => apiClient.groups.create(name),
      onSuccess: invalidate,
    }),
    inviteMemberMutation: useMutation({
      mutationFn: ({ groupId, email }: { groupId: string; email: string }) => apiClient.groups.invite(groupId, email),
      onSuccess: invalidate,
    }),
    acceptInviteMutation: useMutation({
      mutationFn: (token: string) => apiClient.groups.acceptInvite(token),
      onSuccess: invalidate,
    }),
    leaveGroupMutation: useMutation({
      mutationFn: (groupId: string) => apiClient.groups.leave(groupId),
      onSuccess: invalidate,
    }),
    removeMemberMutation: useMutation({
      mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) => apiClient.groups.removeMember(groupId, userId),
      onSuccess: invalidate,
    }),
    deleteGroupMutation: useMutation({
      mutationFn: (groupId: string) => apiClient.groups.delete(groupId),
      onSuccess: invalidate,
    }),
    createGroupBudgetMutation: useMutation({
      mutationFn: (input: GroupBudgetInput) => apiClient.groups.createBudget(input),
      onSuccess: invalidate,
    }),
    deleteGroupBudgetMutation: useMutation({
      mutationFn: (budgetId: string) => apiClient.groups.deleteBudget(budgetId),
      onSuccess: invalidate,
    }),
  };
}

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { AuthSession } from '../types/domain';
import type { PreferencesInput, ProfileInput, User, UserPreferences } from '../types';
import { apiClient } from '../api';
import { queryKeys } from '../state/queryKeys';

function mergeSessionPreferences(queryClient: ReturnType<typeof useQueryClient>, preferences: UserPreferences) {
  const currentSession = queryClient.getQueryData<AuthSession | null>(queryKeys.session);
  if (!currentSession) return;

  queryClient.setQueryData(queryKeys.session, {
    ...currentSession,
    user: {
      ...currentSession.user,
      preferences,
    },
  });
}

function mergeSessionUser(queryClient: ReturnType<typeof useQueryClient>, user: User) {
  const currentSession = queryClient.getQueryData<AuthSession | null>(queryKeys.session);
  if (!currentSession) return;

  queryClient.setQueryData(queryKeys.session, {
    ...currentSession,
    user,
  });
}

type PreferencesQueryOptions = Omit<UseQueryOptions<UserPreferences, Error>, 'queryKey' | 'queryFn'>;

export function usePreferencesQuery(options?: PreferencesQueryOptions) {
  return useQuery<UserPreferences>({
    queryKey: queryKeys.preferences,
    queryFn: () => apiClient.preferences.get(),
    staleTime: 60_000,
    ...options,
  });
}

export function useUpdatePreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PreferencesInput) => apiClient.preferences.update(input),
    onSuccess: (preferences) => {
      queryClient.setQueryData(queryKeys.preferences, preferences);
      mergeSessionPreferences(queryClient, preferences);
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProfileInput) => apiClient.profile.update(input),
    onMutate: async (input) => {
      const previousSession = queryClient.getQueryData<AuthSession | null>(queryKeys.session);
      if (previousSession) {
        mergeSessionUser(queryClient, {
          ...previousSession.user,
          avatarUrl: input.avatarUrl === undefined ? previousSession.user.avatarUrl : input.avatarUrl,
        });
      }

      return { previousSession };
    },
    onError: (_error, _input, context) => {
      if (context?.previousSession) {
        queryClient.setQueryData(queryKeys.session, context.previousSession);
      }
    },
    onSuccess: (user) => {
      mergeSessionUser(queryClient, user);
    },
  });
}

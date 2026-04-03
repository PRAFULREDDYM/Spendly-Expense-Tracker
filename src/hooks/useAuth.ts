import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthPayload } from '../types';
import type { AuthSession } from '../types/domain';
import { apiClient } from '../api';
import { clearAuthedCaches } from '../state/expenseCache';
import { queryKeys } from '../state/queryKeys';

export function useSessionQuery() {
  return useQuery<AuthSession | null>({
    queryKey: queryKeys.session,
    queryFn: () => apiClient.auth.me(),
    staleTime: 60_000,
    retry: false,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AuthPayload) => apiClient.auth.login(input),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.session, session);
    },
  });
}

export function useGoogleLoginMutation() {
  return useMutation({
    mutationFn: (redirectPath?: string) => apiClient.auth.loginWithGoogle(redirectPath),
  });
}

export function useSignUpMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AuthPayload) => apiClient.auth.signUp(input),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.session, session);
    },
  });
}

export function useRefreshSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.auth.refresh(),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.session, session);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.auth.logout(),
    onSuccess: async () => {
      clearAuthedCaches(queryClient);
      queryClient.setQueryData(queryKeys.session, null);
    },
  });
}

export function useAuthSession() {
  const sessionQuery = useSessionQuery();
  const loginMutation = useLoginMutation();
  const googleLoginMutation = useGoogleLoginMutation();
  const signUpMutation = useSignUpMutation();
  const refreshMutation = useRefreshSessionMutation();
  const logoutMutation = useLogoutMutation();

  return {
    sessionQuery,
    session: sessionQuery.data ?? null,
    isAuthenticated: Boolean(sessionQuery.data),
    login: loginMutation.mutateAsync,
    loginWithGoogle: googleLoginMutation.mutateAsync,
    signUp: signUpMutation.mutateAsync,
    refresh: refreshMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    loginMutation,
    googleLoginMutation,
    signUpMutation,
    refreshMutation,
    logoutMutation,
  };
}

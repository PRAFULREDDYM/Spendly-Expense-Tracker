import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from '../api';
import { queryKeys } from '../state/queryKeys';

type DashboardQueryOptions = Omit<UseQueryOptions<Awaited<ReturnType<typeof apiClient.dashboard.summary>>, Error>, 'queryKey' | 'queryFn'>;

export function useDashboardSummaryQuery(options?: DashboardQueryOptions) {
  return useQuery({
    queryKey: queryKeys.dashboard.summary,
    queryFn: () => apiClient.dashboard.summary(),
    staleTime: 20_000,
    ...options,
  });
}

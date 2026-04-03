import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { DateRange, ExpenseFilters } from '../types';
import { apiClient } from '../api';
import { buildCsvFilename, triggerDownload } from '../lib';
import { queryKeys } from '../state/queryKeys';

type ReportSummaryQueryOptions = Omit<UseQueryOptions<Awaited<ReturnType<typeof apiClient.reports.summary>>, Error>, 'queryKey' | 'queryFn'>;

export function useReportSummaryQuery(range?: DateRange, options?: ReportSummaryQueryOptions) {
  return useQuery({
    queryKey: queryKeys.reports.summary(range),
    queryFn: () => apiClient.reports.summary(range),
    staleTime: 20_000,
    ...options,
  });
}

export function useExpenseCsvExportMutation() {
  return useMutation({
    mutationFn: (filters?: ExpenseFilters) => apiClient.reports.exportExpensesCsv(filters),
  });
}

export function useExpenseCsvExportTextMutation() {
  return useMutation({
    mutationFn: (filters?: ExpenseFilters) => apiClient.reports.exportExpensesCsvString(filters),
  });
}

export function useDownloadExpenseCsvMutation() {
  return useMutation({
    mutationFn: async (filters?: ExpenseFilters) => {
      const blob = await apiClient.reports.exportExpensesCsv(filters);
      const range =
        filters?.range?.start && filters?.range?.end
          ? { start: filters.range.start, end: filters.range.end }
          : undefined;
      triggerDownload(blob, buildCsvFilename(range));
      return blob;
    },
  });
}

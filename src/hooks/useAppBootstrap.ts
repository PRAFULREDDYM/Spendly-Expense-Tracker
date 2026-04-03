import { useCategoriesQuery } from './useCategories';
import { useBudgetsQuery } from './useBudgets';
import { usePreferencesQuery } from './usePreferences';
import { useSessionQuery } from './useAuth';

export function useAppBootstrapQueries() {
  const sessionQuery = useSessionQuery();
  const enabled = Boolean(sessionQuery.data);

  const preferencesQuery = usePreferencesQuery({ enabled });
  const categoriesQuery = useCategoriesQuery({ enabled });
  const budgetsQuery = useBudgetsQuery({ enabled });

  return {
    sessionQuery,
    preferencesQuery,
    categoriesQuery,
    budgetsQuery,
    isReady:
      sessionQuery.isSuccess &&
      (!sessionQuery.data ||
        (preferencesQuery.isSuccess && categoriesQuery.isSuccess && budgetsQuery.isSuccess)),
    isLoading:
      sessionQuery.isLoading ||
      (enabled && (preferencesQuery.isLoading || categoriesQuery.isLoading || budgetsQuery.isLoading)),
    error:
      sessionQuery.error ||
      preferencesQuery.error ||
      categoriesQuery.error ||
      budgetsQuery.error ||
      null,
  };
}

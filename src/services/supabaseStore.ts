import type {
  AuthPayload,
  Budget,
  BudgetInput,
  Category,
  CategoryInput,
  DashboardSummary,
  DateRange,
  Expense,
  ExpenseFilters,
  ExpenseInput,
  ExpenseType,
  PaginatedExpensesResponse,
  ProfileInput,
  ReportSummary,
  User,
  UserPreferences,
} from '../types';
import type { AuthSession, RecurrenceFrequency, ThemeMode } from '../types/domain';
import { cacheBudgets, cacheCategories, cacheExpenses, cacheRemoveBudget, cacheRemoveCategory, cacheRemoveExpense, cacheSessionUser, cacheUpsertBudget, cacheUpsertCategory, cacheUpsertExpense, clearLocalWorkspaceCache } from '../db/cacheSync';
import { db, initializeDB, type PendingWrite } from '../db/database';
import { assertSupabaseConfigured, supabase } from '../lib/supabase';
import { localMobileStore } from './localMobileStore';
import { clearPendingWrites, enqueue as enqueuePendingWrite, flushPendingWrites, registerSyncQueueExecutor } from './syncQueue';

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type PreferenceRow = {
  user_id: string;
  currency: UserPreferences['currency'] | null;
  date_format: string | null;
  default_category_id: string | null;
  theme: ThemeMode | null;
  updated_at: string;
};

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
};

type BudgetRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  month: string;
  amount: number;
  currency: Budget['currency'];
  created_at: string;
  updated_at: string;
};

type ExpenseRow = {
  id: string;
  user_id: string;
  group_id: string | null;
  category_id: string | null;
  amount: number;
  currency: Expense['currency'];
  amount_in_primary_currency: number | null;
  expense_date: string;
  description: string;
  type: ExpenseType | null;
  receipt_url: string | null;
  is_recurring: boolean | null;
  recurring_frequency: RecurrenceFrequency | null;
  recurring_interval: number | null;
  next_occurrence_date: string | null;
  created_at: string;
  updated_at: string;
};

const DEFAULT_EMAIL = 'unknown@expense-tracker.app';
const DEFAULT_THEME: ThemeMode = 'system';
const DEFAULT_DATE_FORMAT = 'MM/dd/yyyy';
const STORAGE_BUCKETS = {
  receipts: 'receipts',
  avatars: 'avatars',
} as const;

const defaultCategorySeeds: Array<Pick<Category, 'name' | 'color' | 'icon'>> = [
  { name: 'Food', color: '#22C55E', icon: 'utensils' },
  { name: 'Shopping', color: '#2B7FFF', icon: 'shopping-cart' },
  { name: 'Travel', color: '#F59E0B', icon: 'plane' },
  { name: 'Bills', color: '#EF4444', icon: 'receipt-text' },
  { name: 'Health', color: '#14B8A6', icon: 'heart-pulse' },
  { name: 'Salary', color: '#22C55E', icon: 'briefcase' },
];

function isOfflineError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    typeof navigator !== 'undefined' && navigator.onLine === false
  ) || message.includes('failed to fetch') || message.includes('network') || message.includes('offline') || message.includes('load failed');
}

function isOfflineCacheNotReadyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Sign in and sync your workspace before using the offline cache.') ||
    message.includes('Sign in at least once on this device before using the offline cache.')
  );
}

function formatSessionExpiry(expiresAt?: number | null) {
  if (!expiresAt) {
    return new Date(Date.now() + 1000 * 60 * 60).toISOString();
  }
  return new Date(expiresAt * 1000).toISOString();
}

function getAuthName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metadataName = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : '';
  if (metadataName.trim()) {
    return metadataName.trim();
  }

  const email = user.email?.trim() ?? '';
  return email ? email.split('@')[0] ?? 'You' : 'You';
}

function mapPreferences(row: PreferenceRow | null | undefined): UserPreferences {
  return {
    currency: row?.currency ?? 'USD',
    dateFormat: row?.date_format ?? DEFAULT_DATE_FORMAT,
    defaultCategoryId: row?.default_category_id ?? null,
    theme: row?.theme ?? DEFAULT_THEME,
  };
}

function mapUser(profile: ProfileRow, preferences: UserPreferences): User {
  return {
    id: profile.id,
    email: profile.email ?? DEFAULT_EMAIL,
    name: profile.name?.trim() || getAuthName({ email: profile.email }),
    avatarUrl: profile.avatar_url ?? null,
    createdAt: profile.created_at,
    preferences,
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    month: row.month,
    amount: Number(row.amount),
    currency: row.currency,
    spent: 0,
    remaining: Number(row.amount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExpense(row: ExpenseRow, categoryMap?: Map<string, Category>): Expense {
  return {
    id: row.id,
    userId: row.user_id,
    groupId: row.group_id,
    categoryId: row.category_id,
    amount: Number(row.amount),
    currency: row.currency,
    amountInPrimaryCurrency: Number(row.amount_in_primary_currency ?? row.amount),
    expenseDate: row.expense_date,
    description: row.description,
    type: row.type ?? 'expense',
    category: row.category_id ? categoryMap?.get(row.category_id) ?? null : null,
    receiptUrl: row.receipt_url ?? null,
    isRecurring: Boolean(row.is_recurring),
    recurringConfig: row.is_recurring && row.recurring_frequency && row.recurring_interval
      ? {
          frequency: row.recurring_frequency,
          interval: row.recurring_interval,
          nextOccurrenceDate: row.next_occurrence_date ?? row.expense_date,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toExpenseInsert(input: ExpenseInput, userId: string, id?: string) {
  return {
    ...(id ? { id } : {}),
    user_id: userId,
    group_id: input.groupId ?? null,
    category_id: input.categoryId,
    amount: input.amount,
    currency: input.currency,
    amount_in_primary_currency: input.amount,
    expense_date: input.expenseDate,
    description: input.description.trim(),
    type: input.type ?? 'expense',
    receipt_url: input.receiptUrl ?? null,
    is_recurring: input.isRecurring ?? false,
    recurring_frequency: input.recurringConfig?.frequency ?? null,
    recurring_interval: input.recurringConfig?.interval ?? null,
    next_occurrence_date: input.recurringConfig?.nextOccurrenceDate ?? null,
  };
}

function toExpensePatch(input: Partial<ExpenseInput>) {
  return {
    ...(input.groupId !== undefined ? { group_id: input.groupId } : {}),
    ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
    ...(input.amount !== undefined ? { amount: input.amount, amount_in_primary_currency: input.amount } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.expenseDate !== undefined ? { expense_date: input.expenseDate } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.receiptUrl !== undefined ? { receipt_url: input.receiptUrl } : {}),
    ...(input.isRecurring !== undefined ? { is_recurring: input.isRecurring } : {}),
    ...(input.recurringConfig !== undefined
      ? {
          recurring_frequency: input.recurringConfig?.frequency ?? null,
          recurring_interval: input.recurringConfig?.interval ?? null,
          next_occurrence_date: input.recurringConfig?.nextOccurrenceDate ?? null,
        }
      : {}),
  };
}

function toFilePath(userId: string, file: File) {
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return `${userId}/${crypto.randomUUID()}-${sanitized}`;
}

async function getCurrentSupabaseSession() {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

async function requireSupabaseSession() {
  const session = await getCurrentSupabaseSession();
  if (!session) {
    throw new Error('Sign in to continue.');
  }
  return session;
}

async function requireUserId() {
  const session = await requireSupabaseSession();
  return session.user.id;
}

async function ensureWorkspaceForAuthUser(session: NonNullable<Awaited<ReturnType<typeof getCurrentSupabaseSession>>>) {
  const userId = session.user.id;
  const email = session.user.email ?? DEFAULT_EMAIL;
  const name = getAuthName(session.user);
  const now = new Date().toISOString();

  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,name,avatar_url,created_at,updated_at')
    .eq('id', userId)
    .maybeSingle<ProfileRow>();

  if (profileError) throw profileError;

  let profile = existingProfile;
  if (!profile) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email,
        name,
        avatar_url: null,
        created_at: now,
        updated_at: now,
      }, { onConflict: 'id' })
      .select('id,email,name,avatar_url,created_at,updated_at')
      .single<ProfileRow>();
    if (error) throw error;
    profile = data;
  }

  const { data: existingPreferences, error: preferencesError } = await supabase
    .from('preferences')
    .select('user_id,currency,date_format,default_category_id,theme,updated_at')
    .eq('user_id', userId)
    .maybeSingle<PreferenceRow>();
  if (preferencesError) throw preferencesError;

  let preferences = existingPreferences;
  if (!preferences) {
    const { data, error } = await supabase
      .from('preferences')
      .upsert({
        user_id: userId,
        currency: 'USD',
        date_format: DEFAULT_DATE_FORMAT,
        default_category_id: null,
        theme: DEFAULT_THEME,
        updated_at: now,
      }, { onConflict: 'user_id' })
      .select('user_id,currency,date_format,default_category_id,theme,updated_at')
      .single<PreferenceRow>();
    if (error) throw error;
    preferences = data;
  }

  const { data: categoryRows, error: categoryError } = await supabase
    .from('categories')
    .select('id,user_id,name,color,icon,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (categoryError) throw categoryError;

  if (!categoryRows || categoryRows.length === 0) {
    const { error } = await supabase.from('categories').insert(
      defaultCategorySeeds.map((category) => ({
        user_id: userId,
        ...category,
      })),
    );
    if (error) throw error;
  }

  return {
    profile: mapUser(profile, mapPreferences(preferences)),
    preferences: mapPreferences(preferences),
  };
}

async function fetchWorkspaceRows(userId: string) {
  const [profileResponse, preferencesResponse, categoriesResponse, budgetsResponse, expensesResponse] = await Promise.all([
    supabase.from('profiles').select('id,email,name,avatar_url,created_at,updated_at').eq('id', userId).single<ProfileRow>(),
    supabase.from('preferences').select('user_id,currency,date_format,default_category_id,theme,updated_at').eq('user_id', userId).single<PreferenceRow>(),
    supabase.from('categories').select('id,user_id,name,color,icon,created_at,updated_at').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('budgets').select('id,user_id,category_id,month,amount,currency,created_at,updated_at').eq('user_id', userId).order('month', { ascending: false }),
    supabase.from('expenses').select('id,user_id,group_id,category_id,amount,currency,amount_in_primary_currency,expense_date,description,type,receipt_url,is_recurring,recurring_frequency,recurring_interval,next_occurrence_date,created_at,updated_at').eq('user_id', userId).order('expense_date', { ascending: false }),
  ]);

  if (profileResponse.error) throw profileResponse.error;
  if (preferencesResponse.error) throw preferencesResponse.error;
  if (categoriesResponse.error) throw categoriesResponse.error;
  if (budgetsResponse.error) throw budgetsResponse.error;
  if (expensesResponse.error) throw expensesResponse.error;

  const preferences = mapPreferences(preferencesResponse.data);
  const profile = mapUser(profileResponse.data, preferences);
  const categories = (categoriesResponse.data ?? []).map(mapCategory);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const budgets = (budgetsResponse.data ?? []).map(mapBudget);
  const expenses = (expensesResponse.data ?? []).map((row) => mapExpense(row, categoryMap));

  return {
    profile,
    preferences,
    categories,
    budgets,
    expenses,
  };
}

async function syncWorkspaceToCache(userId: string) {
  const workspace = await fetchWorkspaceRows(userId);
  await localMobileStore.restoreBackup({
    profile: workspace.profile,
    preferences: workspace.preferences,
    categories: workspace.categories,
    budgets: workspace.budgets,
    expenses: workspace.expenses,
  });
  await reapplyPendingWritesLocally(userId);
  return workspace;
}

async function buildSessionFromRemote(session: NonNullable<Awaited<ReturnType<typeof getCurrentSupabaseSession>>>) {
  const { profile, preferences } = await ensureWorkspaceForAuthUser(session);
  await cacheSessionUser(profile, preferences);
  return {
    user: profile,
    expiresAt: formatSessionExpiry(session.expires_at),
  } satisfies AuthSession;
}

async function withOfflineFallback<T>(remoteTask: () => Promise<T>, cacheTask: () => Promise<T>) {
  try {
    return await remoteTask();
  } catch (error) {
    if (!isOfflineError(error)) {
      throw error;
    }
    return cacheTask();
  }
}

function emptyDashboardSummary(): DashboardSummary {
  return {
    totalThisMonth: 0,
    totalLastMonth: 0,
    trendPercent: 0,
    dailyAverage: 0,
    topCategory: null,
    topCategorySpend: 0,
    budgetUsagePercent: 0,
    recentExpenses: [],
  };
}

function emptyReportSummary(range?: DateRange): ReportSummary {
  const today = new Date().toISOString().slice(0, 10);
  return {
    range: {
      start: range?.start ?? today,
      end: range?.end ?? today,
    },
    totalSpent: 0,
    totalBudgeted: 0,
    totalRemaining: 0,
    categoryBreakdown: [],
    trend: [],
  };
}

async function readLocalCategoriesSafe() {
  try {
    return await localMobileStore.listCategories();
  } catch (error) {
    if (isOfflineCacheNotReadyError(error)) {
      return [] as Category[];
    }
    throw error;
  }
}

async function readLocalBudgetsSafe() {
  try {
    return await localMobileStore.listBudgets();
  } catch (error) {
    if (isOfflineCacheNotReadyError(error)) {
      return [] as Budget[];
    }
    throw error;
  }
}

async function readLocalExpensesSafe(filters?: ExpenseFilters) {
  try {
    return await localMobileStore.listExpenses(filters);
  } catch (error) {
    if (isOfflineCacheNotReadyError(error)) {
      return {
        items: [],
        total: 0,
        page: filters?.page ?? 1,
        pageSize: filters?.pageSize ?? 1,
      } satisfies PaginatedExpensesResponse;
    }
    throw error;
  }
}

async function readLocalDashboardSummarySafe() {
  try {
    return await localMobileStore.dashboardSummary();
  } catch (error) {
    if (isOfflineCacheNotReadyError(error)) {
      return emptyDashboardSummary();
    }
    throw error;
  }
}

async function readLocalReportSummarySafe(range?: DateRange, type: ExpenseType | 'all' = 'expense') {
  try {
    return await localMobileStore.reportSummary(range, type);
  } catch (error) {
    if (isOfflineCacheNotReadyError(error)) {
      return emptyReportSummary(range);
    }
    throw error;
  }
}

function buildLocalExpense(userId: string, expenseId: string, input: ExpenseInput): Expense {
  const now = new Date().toISOString();
  return {
    id: expenseId,
    userId,
    groupId: input.groupId ?? null,
    categoryId: input.categoryId ?? null,
    amount: Number(input.amount),
    currency: input.currency,
    amountInPrimaryCurrency: Number(input.amount),
    expenseDate: input.expenseDate,
    description: input.description.trim(),
    type: input.type ?? 'expense',
    category: null,
    receiptUrl: input.receiptUrl ?? null,
    isRecurring: input.isRecurring ?? false,
    recurringConfig: input.recurringConfig ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function buildLocalCategory(userId: string, categoryId: string, input: CategoryInput): Category {
  const now = new Date().toISOString();
  return {
    id: categoryId,
    userId,
    name: input.name.trim(),
    color: input.color,
    icon: input.icon,
    createdAt: now,
    updatedAt: now,
  };
}

function buildLocalBudget(userId: string, budgetId: string, input: BudgetInput): Budget {
  const now = new Date().toISOString();
  return {
    id: budgetId,
    userId,
    categoryId: input.categoryId ?? null,
    month: input.month,
    amount: Number(input.amount),
    currency: input.currency,
    spent: 0,
    remaining: Number(input.amount),
    createdAt: now,
    updatedAt: now,
  };
}

async function applyPendingWriteLocally(write: PendingWrite) {
  const payload = write.payload as Record<string, unknown> | null;

  switch (write.resource) {
    case 'expense':
      if (write.operation === 'create') {
        const record = payload?.record as ExpenseRow | undefined;
        if (record) {
          await cacheUpsertExpense(mapExpense(record));
          return;
        }
        await cacheUpsertExpense(buildLocalExpense(write.userId, write.entityId, write.payload as ExpenseInput));
        return;
      }
      if (write.operation === 'update') {
        const existing = await db.expenses.get(write.entityId);
        if (!existing) return;
        const patch = (payload?.patch ?? write.payload ?? {}) as Record<string, unknown>;
        const categoryId = patch.categoryId ?? patch.category_id;
        const groupId = patch.groupId ?? patch.group_id;
        const expenseDate = patch.expenseDate ?? patch.expense_date;
        const receiptUrl = patch.receiptUrl ?? patch.receipt_url;
        const isRecurring = patch.isRecurring ?? patch.is_recurring;
        const recurringConfig = patch.recurringConfig as
          | { frequency?: unknown; interval?: unknown; nextOccurrenceDate?: unknown }
          | undefined;
        await cacheUpsertExpense({
          ...existing,
          groupId: groupId === undefined ? existing.groupId : (groupId as string | null),
          categoryId: categoryId === undefined ? existing.categoryId : (categoryId as string | null),
          amount: patch.amount === undefined ? existing.amount : Number(patch.amount),
          amountInPrimaryCurrency: patch.amount === undefined ? existing.amountInPrimaryCurrency : Number(patch.amount),
          currency: patch.currency === undefined ? existing.currency : (patch.currency as Expense['currency']),
          expenseDate: expenseDate === undefined ? existing.expenseDate : String(expenseDate),
          description: patch.description === undefined ? existing.description : String(patch.description).trim(),
          type: patch.type === undefined ? existing.type : (patch.type as Expense['type']),
          receiptUrl: receiptUrl === undefined ? existing.receiptUrl : (receiptUrl as string | null),
          isRecurring: isRecurring === undefined ? existing.isRecurring : Boolean(isRecurring),
          recurringConfig: isRecurring === undefined
            ? existing.recurringConfig
            : Boolean(isRecurring)
              ? {
                  frequency: (recurringConfig?.frequency as RecurrenceFrequency)
                    ?? (patch.recurring_frequency as RecurrenceFrequency)
                    ?? existing.recurringConfig?.frequency
                    ?? 'weekly',
                  interval: (recurringConfig?.interval as number)
                    ?? (patch.recurring_interval as number)
                    ?? existing.recurringConfig?.interval
                    ?? 1,
                  nextOccurrenceDate: (recurringConfig?.nextOccurrenceDate as string)
                    ?? (patch.next_occurrence_date as string)
                    ?? existing.recurringConfig?.nextOccurrenceDate
                    ?? existing.expenseDate,
                }
              : null,
          updatedAt: (patch.updatedAt as string | undefined) ?? (patch.updated_at as string | undefined) ?? new Date().toISOString(),
          category: undefined,
        });
        return;
      }
      await cacheRemoveExpense(write.entityId);
      return;
    case 'category':
      if (write.operation === 'create') {
        const record = payload?.record as CategoryRow | undefined;
        if (record) {
          await cacheUpsertCategory(mapCategory(record));
          return;
        }
        await cacheUpsertCategory(buildLocalCategory(write.userId, write.entityId, write.payload as CategoryInput));
        return;
      }
      if (write.operation === 'update') {
        const existing = await db.categories.get(write.entityId);
        if (!existing) return;
        const patch = (payload?.patch ?? write.payload ?? {}) as Record<string, unknown>;
        await cacheUpsertCategory({
          ...existing,
          name: patch.name === undefined ? existing.name : String(patch.name).trim(),
          color: patch.color === undefined ? existing.color : String(patch.color),
          icon: patch.icon === undefined ? existing.icon : String(patch.icon),
          updatedAt: (patch.updatedAt as string | undefined) ?? (patch.updated_at as string | undefined) ?? new Date().toISOString(),
        });
        return;
      }
      await cacheRemoveCategory(write.entityId);
      return;
    case 'budget':
      if (write.operation === 'create') {
        const record = payload?.record as BudgetRow | undefined;
        if (record) {
          await cacheUpsertBudget(mapBudget(record));
          return;
        }
        await cacheUpsertBudget(buildLocalBudget(write.userId, write.entityId, write.payload as BudgetInput));
        return;
      }
      if (write.operation === 'update') {
        const existing = await db.budgets.get(write.entityId);
        if (!existing) return;
        const patch = (payload?.patch ?? write.payload ?? {}) as Record<string, unknown>;
        const categoryId = patch.categoryId ?? patch.category_id;
        const month = patch.month;
        await cacheUpsertBudget({
          ...existing,
          categoryId: categoryId === undefined ? existing.categoryId : (categoryId as string | null),
          month: month === undefined ? existing.month : String(month),
          amount: patch.amount === undefined ? existing.amount : Number(patch.amount),
          currency: patch.currency === undefined ? existing.currency : String(patch.currency) as Budget['currency'],
          updatedAt: (patch.updatedAt as string | undefined) ?? (patch.updated_at as string | undefined) ?? new Date().toISOString(),
        });
        return;
      }
      await cacheRemoveBudget(write.entityId);
  }
}

async function reapplyPendingWritesLocally(userId: string, resource?: PendingWrite['resource']) {
  await initializeDB();
  let writes = await db.pending_writes.where('userId').equals(userId).toArray();
  if (resource) {
    writes = writes.filter((write) => write.resource === resource);
  }
  writes.sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));
  for (const write of writes) {
    await applyPendingWriteLocally(write);
  }
}

async function createExpenseRemote(userId: string, expenseId: string, input: ExpenseInput): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .upsert(toExpenseInsert(input, userId, expenseId), { onConflict: 'id' })
    .select('id,user_id,group_id,category_id,amount,currency,amount_in_primary_currency,expense_date,description,type,receipt_url,is_recurring,recurring_frequency,recurring_interval,next_occurrence_date,created_at,updated_at')
    .single<ExpenseRow>();
  if (error) throw error;
  const categories = await refreshCategoriesCache(userId);
  const expense = mapExpense(data, new Map(categories.map((category) => [category.id, category])));
  await cacheUpsertExpense(expense);
  return expense;
}

async function updateExpenseRemote(userId: string, expenseId: string, input: Partial<ExpenseInput>): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .update(toExpensePatch(input))
    .eq('id', expenseId)
    .eq('user_id', userId)
    .select('id,user_id,group_id,category_id,amount,currency,amount_in_primary_currency,expense_date,description,type,receipt_url,is_recurring,recurring_frequency,recurring_interval,next_occurrence_date,created_at,updated_at')
    .single<ExpenseRow>();
  if (error) throw error;
  const categories = await refreshCategoriesCache(userId);
  const expense = mapExpense(data, new Map(categories.map((category) => [category.id, category])));
  await cacheUpsertExpense(expense);
  return expense;
}

async function deleteExpenseRemote(userId: string, expenseId: string) {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId).eq('user_id', userId);
  if (error) throw error;
  await cacheRemoveExpense(expenseId);
}

async function createCategoryRemote(userId: string, categoryId: string, input: CategoryInput): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .upsert({
      id: categoryId,
      user_id: userId,
      name: input.name.trim(),
      color: input.color,
      icon: input.icon,
    }, { onConflict: 'id' })
    .select('id,user_id,name,color,icon,created_at,updated_at')
    .single<CategoryRow>();
  if (error) throw error;
  const category = mapCategory(data);
  await cacheUpsertCategory(category);
  return category;
}

async function updateCategoryRemote(userId: string, categoryId: string, input: Partial<CategoryInput>): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
    })
    .eq('id', categoryId)
    .eq('user_id', userId)
    .select('id,user_id,name,color,icon,created_at,updated_at')
    .single<CategoryRow>();
  if (error) throw error;
  const category = mapCategory(data);
  await cacheUpsertCategory(category);
  return category;
}

async function deleteCategoryRemote(userId: string, categoryId: string) {
  const { error } = await supabase.from('categories').delete().eq('id', categoryId).eq('user_id', userId);
  if (error) throw error;
  await cacheRemoveCategory(categoryId);
}

async function createBudgetRemote(userId: string, budgetId: string, input: BudgetInput): Promise<Budget> {
  const { data, error } = await supabase
    .from('budgets')
    .upsert({
      id: budgetId,
      user_id: userId,
      category_id: input.categoryId,
      month: input.month,
      amount: input.amount,
      currency: input.currency,
    }, { onConflict: 'id' })
    .select('id,user_id,category_id,month,amount,currency,created_at,updated_at')
    .single<BudgetRow>();
  if (error) throw error;
  const budget = mapBudget(data);
  await cacheUpsertBudget(budget);
  return (await localMobileStore.listBudgets()).find((item) => item.id === budget.id) ?? budget;
}

async function updateBudgetRemote(userId: string, budgetId: string, input: Partial<BudgetInput>): Promise<Budget> {
  const { data, error } = await supabase
    .from('budgets')
    .update({
      ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
      ...(input.month !== undefined ? { month: input.month } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
    })
    .eq('id', budgetId)
    .eq('user_id', userId)
    .select('id,user_id,category_id,month,amount,currency,created_at,updated_at')
    .single<BudgetRow>();
  if (error) throw error;
  const budget = mapBudget(data);
  await cacheUpsertBudget(budget);
  return (await localMobileStore.listBudgets()).find((item) => item.id === budget.id) ?? budget;
}

async function deleteBudgetRemote(userId: string, budgetId: string) {
  const { error } = await supabase.from('budgets').delete().eq('id', budgetId).eq('user_id', userId);
  if (error) throw error;
  await cacheRemoveBudget(budgetId);
}

registerSyncQueueExecutor({
  expense: async (write) => {
    const payload = write.payload as Record<string, unknown> | null;
    if (write.operation === 'create') {
      const record = payload?.record as ExpenseRow | undefined;
      if (record) {
        const { data, error } = await supabase
          .from('expenses')
          .upsert(record, { onConflict: 'id' })
          .select('id,user_id,group_id,category_id,amount,currency,amount_in_primary_currency,expense_date,description,type,receipt_url,is_recurring,recurring_frequency,recurring_interval,next_occurrence_date,created_at,updated_at')
          .single<ExpenseRow>();
        if (error) throw error;
        const categories = await refreshCategoriesCache(write.userId);
        const expense = mapExpense(data, new Map(categories.map((category) => [category.id, category])));
        await cacheUpsertExpense(expense);
        return;
      }
      await createExpenseRemote(write.userId, write.entityId, write.payload as ExpenseInput);
      return;
    }
    if (write.operation === 'update') {
      const patch = (payload?.patch ?? write.payload ?? {}) as Partial<ExpenseInput> & { updated_at?: string };
      const userId = (payload?.user_id as string | undefined) ?? write.userId;
      const { data, error } = await supabase
        .from('expenses')
        .update(toExpensePatch(patch))
        .eq('id', write.entityId)
        .eq('user_id', userId)
        .select('id,user_id,group_id,category_id,amount,currency,amount_in_primary_currency,expense_date,description,type,receipt_url,is_recurring,recurring_frequency,recurring_interval,next_occurrence_date,created_at,updated_at')
        .single<ExpenseRow>();
      if (error) throw error;
      const categories = await refreshCategoriesCache(userId);
      const expense = mapExpense(data, new Map(categories.map((category) => [category.id, category])));
      await cacheUpsertExpense(expense);
      return;
    }
    await deleteExpenseRemote((payload?.user_id as string | undefined) ?? write.userId, write.entityId);
  },
  category: async (write) => {
    const payload = write.payload as Record<string, unknown> | null;
    if (write.operation === 'create') {
      const record = payload?.record as CategoryRow | undefined;
      if (record) {
        const { data, error } = await supabase
          .from('categories')
          .upsert(record, { onConflict: 'id' })
          .select('id,user_id,name,color,icon,created_at,updated_at')
          .single<CategoryRow>();
        if (error) throw error;
        const category = mapCategory(data);
        await cacheUpsertCategory(category);
        return;
      }
      await createCategoryRemote(write.userId, write.entityId, write.payload as CategoryInput);
      return;
    }
    if (write.operation === 'update') {
      const patch = (payload?.patch ?? write.payload ?? {}) as Partial<CategoryInput> & { updated_at?: string };
      const userId = (payload?.user_id as string | undefined) ?? write.userId;
      const { data, error } = await supabase
        .from('categories')
        .update(patch)
        .eq('id', write.entityId)
        .eq('user_id', userId)
        .select('id,user_id,name,color,icon,created_at,updated_at')
        .single<CategoryRow>();
      if (error) throw error;
      const category = mapCategory(data);
      await cacheUpsertCategory(category);
      return;
    }
    await deleteCategoryRemote((payload?.user_id as string | undefined) ?? write.userId, write.entityId);
  },
  budget: async (write) => {
    const payload = write.payload as Record<string, unknown> | null;
    if (write.operation === 'create') {
      const record = payload?.record as BudgetRow | undefined;
      if (record) {
        const { data, error } = await supabase
          .from('budgets')
          .upsert(record, { onConflict: 'id' })
          .select('id,user_id,category_id,month,amount,currency,created_at,updated_at')
          .single<BudgetRow>();
        if (error) throw error;
        const budget = mapBudget(data);
        await cacheUpsertBudget(budget);
        return;
      }
      await createBudgetRemote(write.userId, write.entityId, write.payload as BudgetInput);
      return;
    }
    if (write.operation === 'update') {
      const patch = (payload?.patch ?? write.payload ?? {}) as Partial<BudgetInput> & { updated_at?: string };
      const userId = (payload?.user_id as string | undefined) ?? write.userId;
      const { data, error } = await supabase
        .from('budgets')
        .update(patch)
        .eq('id', write.entityId)
        .eq('user_id', userId)
        .select('id,user_id,category_id,month,amount,currency,created_at,updated_at')
        .single<BudgetRow>();
      if (error) throw error;
      const budget = mapBudget(data);
      await cacheUpsertBudget(budget);
      return;
    }
    await deleteBudgetRemote((payload?.user_id as string | undefined) ?? write.userId, write.entityId);
  },
});

async function refreshCategoriesCache(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('id,user_id,name,color,icon,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const categories = (data ?? []).map(mapCategory);
  await cacheCategories(categories);
  await reapplyPendingWritesLocally(userId, 'category');
  return categories;
}

async function refreshBudgetsCache(userId: string) {
  const { data, error } = await supabase
    .from('budgets')
    .select('id,user_id,category_id,month,amount,currency,created_at,updated_at')
    .eq('user_id', userId)
    .order('month', { ascending: false });
  if (error) throw error;
  const budgets = (data ?? []).map(mapBudget);
  await cacheBudgets(budgets);
  await reapplyPendingWritesLocally(userId, 'budget');
  return budgets;
}

async function refreshExpensesCache(userId: string) {
  const [expenseResponse, categories] = await Promise.all([
    supabase
      .from('expenses')
      .select('id,user_id,group_id,category_id,amount,currency,amount_in_primary_currency,expense_date,description,type,receipt_url,is_recurring,recurring_frequency,recurring_interval,next_occurrence_date,created_at,updated_at')
      .eq('user_id', userId)
      .order('expense_date', { ascending: false }),
    refreshCategoriesCache(userId),
  ]);

  if (expenseResponse.error) throw expenseResponse.error;

  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const expenses = (expenseResponse.data ?? []).map((row) => mapExpense(row, categoryMap));
  await cacheExpenses(expenses);
  await reapplyPendingWritesLocally(userId, 'expense');
  return expenses;
}

async function refreshPreferencesCache(userId: string) {
  const [profileResponse, preferencesResponse] = await Promise.all([
    supabase.from('profiles').select('id,email,name,avatar_url,created_at,updated_at').eq('id', userId).single<ProfileRow>(),
    supabase.from('preferences').select('user_id,currency,date_format,default_category_id,theme,updated_at').eq('user_id', userId).single<PreferenceRow>(),
  ]);
  if (profileResponse.error) throw profileResponse.error;
  if (preferencesResponse.error) throw preferencesResponse.error;
  const preferences = mapPreferences(preferencesResponse.data);
  const profile = mapUser(profileResponse.data, preferences);
  await cacheSessionUser(profile, preferences);
  return { profile, preferences };
}

export const supabaseStore = {
  async setupWorkspace(input: { name: string; currency: UserPreferences['currency']; email?: string }) {
    const session = await requireSupabaseSession();
    const userId = session.user.id;
    const now = new Date().toISOString();

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: input.email?.trim() || session.user.email || DEFAULT_EMAIL,
        name: input.name.trim(),
        updated_at: now,
      }, { onConflict: 'id' })
      .select('id,email,name,avatar_url,created_at,updated_at')
      .single<ProfileRow>();
    if (profileError) throw profileError;

    const { data: preferencesRow, error: preferencesError } = await supabase
      .from('preferences')
      .upsert({
        user_id: userId,
        currency: input.currency,
        date_format: DEFAULT_DATE_FORMAT,
        default_category_id: null,
        theme: DEFAULT_THEME,
        updated_at: now,
      }, { onConflict: 'user_id' })
      .select('user_id,currency,date_format,default_category_id,theme,updated_at')
      .single<PreferenceRow>();
    if (preferencesError) throw preferencesError;

    const preferences = mapPreferences(preferencesRow);
    const profile = mapUser(profileRow, preferences);
    await cacheSessionUser(profile, preferences);
    await ensureWorkspaceForAuthUser(session);
    return {
      user: profile,
      expiresAt: formatSessionExpiry(session.expires_at),
    } satisfies AuthSession;
  },

  async signUp(input: AuthPayload): Promise<AuthSession> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          name: input.name?.trim() || input.email.split('@')[0] || 'You',
        },
      },
    });

    if (error) throw error;
    if (!data.session) {
      throw new Error('Check your email to confirm your account, then sign in.');
    }

    await flushPendingWrites();
    const session = await buildSessionFromRemote(data.session);
    await syncWorkspaceToCache(data.session.user.id);
    return session;
  },

  async loginWithGoogle(redirectPath?: string): Promise<void> {
    assertSupabaseConfigured();
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}${redirectPath && redirectPath.startsWith('/') ? redirectPath : '/dashboard'}`
      : undefined;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      throw error;
    }

    if (typeof window !== 'undefined' && data?.url) {
      window.location.assign(data.url);
    }
  },

  async login(input: AuthPayload): Promise<AuthSession> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) throw error;
    if (!data.session) throw new Error('Could not start your session.');
    await flushPendingWrites();
    const session = await buildSessionFromRemote(data.session);
    await syncWorkspaceToCache(data.session.user.id);
    return session;
  },

  async logout(): Promise<void> {
    assertSupabaseConfigured();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await clearLocalWorkspaceCache();
  },

  async refresh(): Promise<AuthSession> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    if (!data.session) throw new Error('Could not refresh your session.');
    await flushPendingWrites();
    const session = await buildSessionFromRemote(data.session);
    await syncWorkspaceToCache(data.session.user.id);
    return session;
  },

  async me(): Promise<AuthSession | null> {
    try {
      const session = await getCurrentSupabaseSession();
      if (!session) {
        return null;
      }
      await flushPendingWrites();
      return await buildSessionFromRemote(session);
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }
      try {
        return await localMobileStore.me();
      } catch (offlineError) {
        const message = offlineError instanceof Error ? offlineError.message : String(offlineError);
        if (
          message.includes('Sign in and sync your workspace before using the offline cache') ||
          message.includes('Sign in at least once on this device before using the offline cache')
        ) {
          return null;
        }
        throw offlineError;
      }
    }
  },

  async listExpenses(filters?: ExpenseFilters): Promise<PaginatedExpensesResponse> {
    return withOfflineFallback(async () => {
      const userId = await requireUserId();
      await refreshExpensesCache(userId);
      return readLocalExpensesSafe(filters);
    }, () => readLocalExpensesSafe(filters));
  },

  async getExpense(expenseId: string): Promise<Expense> {
    return withOfflineFallback(async () => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from('expenses')
        .select('id,user_id,group_id,category_id,amount,currency,amount_in_primary_currency,expense_date,description,type,receipt_url,is_recurring,recurring_frequency,recurring_interval,next_occurrence_date,created_at,updated_at')
        .eq('user_id', userId)
        .eq('id', expenseId)
        .single<ExpenseRow>();
      if (error) throw error;
      const categories = await refreshCategoriesCache(userId);
      const expense = mapExpense(data, new Map(categories.map((category) => [category.id, category])));
      await cacheUpsertExpense(expense);
      return expense;
    }, () => localMobileStore.getExpense(expenseId));
  },

  async createExpense(input: ExpenseInput): Promise<Expense> {
    const userId = await requireUserId();
    const expenseId = crypto.randomUUID();
    const expense = buildLocalExpense(userId, expenseId, input);
    await cacheUpsertExpense(expense);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await enqueuePendingWrite({
        userId,
        resource: 'expense',
        operation: 'create',
        entityId: expenseId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return expense;
    }

    try {
      return await createExpenseRemote(userId, expenseId, input);
    } catch (error) {
      console.warn('[Sync] Queueing expense create after remote write failure.', error);
      await enqueuePendingWrite({
        userId,
        resource: 'expense',
        operation: 'create',
        entityId: expenseId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return expense;
    }
  },

  async updateExpense(expenseId: string, input: Partial<ExpenseInput>): Promise<Expense> {
    const userId = await requireUserId();
    await applyPendingWriteLocally({
      userId,
      resource: 'expense',
      operation: 'update',
      entityId: expenseId,
      payload: input,
      createdAt: new Date().toISOString(),
    });
    const optimisticExpense = await localMobileStore.getExpense(expenseId);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await enqueuePendingWrite({
        userId,
        resource: 'expense',
        operation: 'update',
        entityId: expenseId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return optimisticExpense;
    }

    try {
      return await updateExpenseRemote(userId, expenseId, input);
    } catch (error) {
      console.warn('[Sync] Queueing expense update after remote write failure.', error);
      await enqueuePendingWrite({
        userId,
        resource: 'expense',
        operation: 'update',
        entityId: expenseId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return optimisticExpense;
    }
  },

  async removeExpense(expenseId: string): Promise<void> {
    const userId = await requireUserId();
    await cacheRemoveExpense(expenseId);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await enqueuePendingWrite({
        userId,
        resource: 'expense',
        operation: 'delete',
        entityId: expenseId,
        payload: null,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    try {
      await deleteExpenseRemote(userId, expenseId);
    } catch (error) {
      console.warn('[Sync] Queueing expense delete after remote write failure.', error);
      await enqueuePendingWrite({
        userId,
        resource: 'expense',
        operation: 'delete',
        entityId: expenseId,
        payload: null,
        createdAt: new Date().toISOString(),
      });
    }
  },

  async listCategories(): Promise<Category[]> {
    return withOfflineFallback(async () => {
      const userId = await requireUserId();
      return refreshCategoriesCache(userId);
    }, () => readLocalCategoriesSafe());
  },

  async createCategory(input: CategoryInput): Promise<Category> {
    const userId = await requireUserId();
    const categoryId = crypto.randomUUID();
    const category = buildLocalCategory(userId, categoryId, input);
    await cacheUpsertCategory(category);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await enqueuePendingWrite({
        userId,
        resource: 'category',
        operation: 'create',
        entityId: categoryId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return category;
    }

    try {
      return await createCategoryRemote(userId, categoryId, input);
    } catch (error) {
      console.warn('[Sync] Queueing category create after remote write failure.', error);
      await enqueuePendingWrite({
        userId,
        resource: 'category',
        operation: 'create',
        entityId: categoryId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return category;
    }
  },

  async updateCategory(categoryId: string, input: Partial<CategoryInput>): Promise<Category> {
    const userId = await requireUserId();
    await applyPendingWriteLocally({
      userId,
      resource: 'category',
      operation: 'update',
      entityId: categoryId,
      payload: input,
      createdAt: new Date().toISOString(),
    });
    const optimisticCategory = (await localMobileStore.listCategories()).find((category) => category.id === categoryId);
    if (!optimisticCategory) throw new Error('Category not found.');

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await enqueuePendingWrite({
        userId,
        resource: 'category',
        operation: 'update',
        entityId: categoryId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return optimisticCategory;
    }

    try {
      return await updateCategoryRemote(userId, categoryId, input);
    } catch (error) {
      console.warn('[Sync] Queueing category update after remote write failure.', error);
      await enqueuePendingWrite({
        userId,
        resource: 'category',
        operation: 'update',
        entityId: categoryId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return optimisticCategory;
    }
  },

  async removeCategory(categoryId: string): Promise<void> {
    const userId = await requireUserId();
    await cacheRemoveCategory(categoryId);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await enqueuePendingWrite({
        userId,
        resource: 'category',
        operation: 'delete',
        entityId: categoryId,
        payload: null,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    try {
      await deleteCategoryRemote(userId, categoryId);
    } catch (error) {
      console.warn('[Sync] Queueing category delete after remote write failure.', error);
      await enqueuePendingWrite({
        userId,
        resource: 'category',
        operation: 'delete',
        entityId: categoryId,
        payload: null,
        createdAt: new Date().toISOString(),
      });
    }
  },

  async listBudgets(): Promise<Budget[]> {
    return withOfflineFallback(async () => {
      const userId = await requireUserId();
      await refreshBudgetsCache(userId);
      return readLocalBudgetsSafe();
    }, () => readLocalBudgetsSafe());
  },

  async createBudget(input: BudgetInput): Promise<Budget> {
    const userId = await requireUserId();
    const budgetId = crypto.randomUUID();
    const budget = buildLocalBudget(userId, budgetId, input);
    await cacheUpsertBudget(budget);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await enqueuePendingWrite({
        userId,
        resource: 'budget',
        operation: 'create',
        entityId: budgetId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return (await localMobileStore.listBudgets()).find((item) => item.id === budget.id) ?? budget;
    }

    try {
      return await createBudgetRemote(userId, budgetId, input);
    } catch (error) {
      console.warn('[Sync] Queueing budget create after remote write failure.', error);
      await enqueuePendingWrite({
        userId,
        resource: 'budget',
        operation: 'create',
        entityId: budgetId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return (await localMobileStore.listBudgets()).find((item) => item.id === budget.id) ?? budget;
    }
  },

  async updateBudget(budgetId: string, input: Partial<BudgetInput>): Promise<Budget> {
    const userId = await requireUserId();
    await applyPendingWriteLocally({
      userId,
      resource: 'budget',
      operation: 'update',
      entityId: budgetId,
      payload: input,
      createdAt: new Date().toISOString(),
    });
    const optimisticBudget = (await localMobileStore.listBudgets()).find((budget) => budget.id === budgetId);
    if (!optimisticBudget) throw new Error('Budget not found.');

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await enqueuePendingWrite({
        userId,
        resource: 'budget',
        operation: 'update',
        entityId: budgetId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return (await localMobileStore.listBudgets()).find((item) => item.id === optimisticBudget.id) ?? optimisticBudget;
    }

    try {
      return await updateBudgetRemote(userId, budgetId, input);
    } catch (error) {
      console.warn('[Sync] Queueing budget update after remote write failure.', error);
      await enqueuePendingWrite({
        userId,
        resource: 'budget',
        operation: 'update',
        entityId: budgetId,
        payload: input,
        createdAt: new Date().toISOString(),
      });
      return (await localMobileStore.listBudgets()).find((item) => item.id === optimisticBudget.id) ?? optimisticBudget;
    }
  },

  async removeBudget(budgetId: string): Promise<void> {
    const userId = await requireUserId();
    await cacheRemoveBudget(budgetId);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await enqueuePendingWrite({
        userId,
        resource: 'budget',
        operation: 'delete',
        entityId: budgetId,
        payload: null,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    try {
      await deleteBudgetRemote(userId, budgetId);
    } catch (error) {
      console.warn('[Sync] Queueing budget delete after remote write failure.', error);
      await enqueuePendingWrite({
        userId,
        resource: 'budget',
        operation: 'delete',
        entityId: budgetId,
        payload: null,
        createdAt: new Date().toISOString(),
      });
    }
  },

  async dashboardSummary(): Promise<DashboardSummary> {
    return withOfflineFallback(async () => {
      const userId = await requireUserId();
      await syncWorkspaceToCache(userId);
      return readLocalDashboardSummarySafe();
    }, () => readLocalDashboardSummarySafe());
  },

  async reportSummary(range?: DateRange, type: ExpenseType | 'all' = 'expense'): Promise<ReportSummary> {
    return withOfflineFallback(async () => {
      const userId = await requireUserId();
      await syncWorkspaceToCache(userId);
      return readLocalReportSummarySafe(range, type);
    }, () => readLocalReportSummarySafe(range, type));
  },

  async exportExpensesCsvBlob(filters?: ExpenseFilters): Promise<Blob> {
    const userId = await requireUserId();
    await syncWorkspaceToCache(userId);
    return localMobileStore.exportExpensesCsvBlob(filters);
  },

  async exportExpensesCsvText(filters?: ExpenseFilters): Promise<string> {
    const userId = await requireUserId();
    await syncWorkspaceToCache(userId);
    return localMobileStore.exportExpensesCsvText(filters);
  },

  async getPreferences(): Promise<UserPreferences> {
    return withOfflineFallback(async () => {
      const userId = await requireUserId();
      const { preferences } = await refreshPreferencesCache(userId);
      return preferences;
    }, () => localMobileStore.getPreferences());
  },

  async updatePreferences(input: UserPreferences): Promise<UserPreferences> {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('preferences')
      .update({
        currency: input.currency,
        date_format: input.dateFormat,
        default_category_id: input.defaultCategoryId,
        theme: input.theme,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('user_id,currency,date_format,default_category_id,theme,updated_at')
      .single<PreferenceRow>();
    if (error) throw error;
    const preferences = mapPreferences(data);
    const cachedSession = await this.me();
    if (cachedSession) {
      await cacheSessionUser({ ...cachedSession.user, preferences }, preferences);
    }
    return preferences;
  },

  async getProfile(): Promise<User> {
    return withOfflineFallback(async () => {
      const userId = await requireUserId();
      const { profile } = await refreshPreferencesCache(userId);
      return profile;
    }, () => localMobileStore.getProfile());
  },

  async updateProfile(input: ProfileInput): Promise<User> {
    const session = await requireSupabaseSession();
    const userId = session.user.id;
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...(input.avatarUrl !== undefined ? { avatar_url: input.avatarUrl } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id,email,name,avatar_url,created_at,updated_at')
      .single<ProfileRow>();
    if (error) throw error;
    const preferences = await this.getPreferences();
    const user = mapUser(data, preferences);
    await cacheSessionUser(user, preferences);
    return user;
  },

  async uploadReceipt(file: File): Promise<string> {
    const userId = await requireUserId();
    const path = toFilePath(userId, file);
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.receipts).upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(STORAGE_BUCKETS.receipts).getPublicUrl(path);
    return data.publicUrl;
  },

  async uploadAvatar(file: File): Promise<string> {
    const userId = await requireUserId();
    const path = toFilePath(userId, file);
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.avatars).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(STORAGE_BUCKETS.avatars).getPublicUrl(path);
    return data.publicUrl;
  },

  async exportBackup() {
    const userId = await requireUserId();
    await syncWorkspaceToCache(userId);
    return localMobileStore.exportBackup();
  },

  async restoreBackup(payload: Parameters<typeof localMobileStore.restoreBackup>[0]) {
    const session = await requireSupabaseSession();
    const userId = session.user.id;

    const normalizedProfile = payload.profile
      ? {
          ...payload.profile,
          id: userId,
          email: session.user.email ?? payload.profile.email ?? DEFAULT_EMAIL,
        }
      : null;

    const normalizedPreferences = {
      currency: payload.preferences?.currency ?? 'USD',
      dateFormat: payload.preferences?.dateFormat ?? DEFAULT_DATE_FORMAT,
      defaultCategoryId: payload.preferences?.defaultCategoryId ?? null,
      theme: payload.preferences?.theme ?? DEFAULT_THEME,
    } satisfies UserPreferences;

    const normalizedCategories = (payload.categories ?? []).map((category) => ({
      ...category,
      userId: userId,
    }));
    const normalizedBudgets = (payload.budgets ?? []).map((budget) => ({
      ...budget,
      userId: userId,
    }));
    const normalizedExpenses = (payload.expenses ?? []).map((expense) => ({
      ...expense,
      userId: userId,
      category: undefined,
    }));

    const categoryIdSet = new Set(normalizedCategories.map((category) => category.id));

    const { error: expensesDeleteError } = await supabase.from('expenses').delete().eq('user_id', userId);
    if (expensesDeleteError) throw expensesDeleteError;
    const { error: budgetsDeleteError } = await supabase.from('budgets').delete().eq('user_id', userId);
    if (budgetsDeleteError) throw budgetsDeleteError;
    const { error: categoriesDeleteError } = await supabase.from('categories').delete().eq('user_id', userId);
    if (categoriesDeleteError) throw categoriesDeleteError;

    if (normalizedProfile) {
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email: normalizedProfile.email,
        name: normalizedProfile.name,
        avatar_url: normalizedProfile.avatarUrl,
        created_at: normalizedProfile.createdAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (error) throw error;
    }

    const { error: prefError } = await supabase.from('preferences').upsert({
      user_id: userId,
      currency: normalizedPreferences.currency,
      date_format: normalizedPreferences.dateFormat,
      default_category_id: normalizedPreferences.defaultCategoryId && categoryIdSet.has(normalizedPreferences.defaultCategoryId)
        ? normalizedPreferences.defaultCategoryId
        : null,
      theme: normalizedPreferences.theme,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (prefError) throw prefError;

    if (normalizedCategories.length) {
      const { error } = await supabase.from('categories').insert(normalizedCategories.map((category) => ({
        id: category.id,
        user_id: userId,
        name: category.name,
        color: category.color,
        icon: category.icon,
        created_at: category.createdAt,
        updated_at: category.updatedAt,
      })));
      if (error) throw error;
    }

    if (normalizedBudgets.length) {
      const { error } = await supabase.from('budgets').insert(normalizedBudgets.map((budget) => ({
        id: budget.id,
        user_id: userId,
        category_id: budget.categoryId && categoryIdSet.has(budget.categoryId) ? budget.categoryId : null,
        month: budget.month,
        amount: budget.amount,
        currency: budget.currency,
        created_at: budget.createdAt,
        updated_at: budget.updatedAt,
      })));
      if (error) throw error;
    }

    if (normalizedExpenses.length) {
      const { error } = await supabase.from('expenses').insert(normalizedExpenses.map((expense) => ({
        id: expense.id,
        user_id: userId,
        category_id: expense.categoryId && categoryIdSet.has(expense.categoryId) ? expense.categoryId : null,
        amount: expense.amount,
        currency: expense.currency,
        amount_in_primary_currency: expense.amountInPrimaryCurrency,
        expense_date: expense.expenseDate,
        description: expense.description,
        type: expense.type ?? 'expense',
        receipt_url: expense.receiptUrl,
        is_recurring: expense.isRecurring,
        recurring_frequency: expense.recurringConfig?.frequency ?? null,
        recurring_interval: expense.recurringConfig?.interval ?? null,
        next_occurrence_date: expense.recurringConfig?.nextOccurrenceDate ?? null,
        created_at: expense.createdAt,
        updated_at: expense.updatedAt,
      })));
      if (error) throw error;
    }

    await syncWorkspaceToCache(userId);
    return this.me();
  },

  async deleteAccount() {
    const session = await requireSupabaseSession();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Reconnect to the internet before deleting your account.');
    }

    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      const message = error.message?.toLowerCase() ?? '';
      if (message.includes('delete_my_account')) {
        throw new Error('Account deletion is not enabled yet. Run the latest supabase/schema.sql in your Supabase project and try again.');
      }
      throw error;
    }

    await clearPendingWrites();
    await localMobileStore.resetAllData();

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // The auth user may already be gone server-side; local cleanup above is the important part.
    }
  },

  async resetAllData() {
    const session = await requireSupabaseSession();
    const userId = session.user.id;

    const { error: expensesDeleteError } = await supabase.from('expenses').delete().eq('user_id', userId);
    if (expensesDeleteError) throw expensesDeleteError;
    const { error: budgetsDeleteError } = await supabase.from('budgets').delete().eq('user_id', userId);
    if (budgetsDeleteError) throw budgetsDeleteError;
    const { error: categoriesDeleteError } = await supabase.from('categories').delete().eq('user_id', userId);
    if (categoriesDeleteError) throw categoriesDeleteError;
    const { error: preferencesError } = await supabase
      .from('preferences')
      .upsert({
        user_id: userId,
        currency: 'USD',
        date_format: DEFAULT_DATE_FORMAT,
        default_category_id: null,
        theme: DEFAULT_THEME,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (preferencesError) throw preferencesError;

    await clearPendingWrites();
    await clearLocalWorkspaceCache();
    await ensureWorkspaceForAuthUser(session);
    await syncWorkspaceToCache(userId);
  },
};

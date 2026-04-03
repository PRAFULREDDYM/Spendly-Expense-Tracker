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
import type { AuthSession } from '../types/domain';
import { buildCsv } from '../features/shared/csv';
import { fileToDataUrl } from '../utils/fileUtils';
import { db, initializeDB } from '../db/database';
import {
  budgetsDb,
  categoriesDb,
  expensesDb,
  getBackupPayload,
  getPreferencesRecord,
  getProfileRecord,
  preferencesDb,
  profileDb,
  resetDatabase,
  restoreBackupPayload,
} from '../db/queries';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 365 * 10;
const DEFAULT_EMAIL = 'offline-cache@expense-tracker.app';

const defaultCategorySeeds: Array<Pick<Category, 'name' | 'color' | 'icon'>> = [
  { name: 'Food', color: '#22C55E', icon: 'utensils' },
  { name: 'Shopping', color: '#2B7FFF', icon: 'shopping-bag' },
  { name: 'Travel', color: '#F59E0B', icon: 'plane' },
  { name: 'Bills', color: '#EF4444', icon: 'receipt' },
  { name: 'Health', color: '#14B8A6', icon: 'heart-pulse' },
  { name: 'Salary', color: '#22C55E', icon: 'badge-dollar-sign' },
];

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso() {
  return new Date().toISOString();
}

function toSession(user: User): AuthSession {
  return {
    user: cloneValue(user),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
  };
}

async function ensureWorkspaceReady() {
  await initializeDB();
}

async function ensureSeedCategories() {
  const existing = await categoriesDb.getAll();
  if (existing.length > 0) {
    return existing;
  }

  const created = await Promise.all(
    defaultCategorySeeds.map((category) => categoriesDb.create(category)),
  );
  return created;
}

async function getRequiredProfile() {
  await ensureWorkspaceReady();
  const profile = await getProfileRecord();
  if (!profile) {
    throw new Error('Sign in and sync your workspace before using the offline cache.');
  }
  return profile;
}

async function getHydratedCategories() {
  await ensureWorkspaceReady();
  return categoriesDb.getAll();
}

function withCategory(expense: Expense, categories: Category[]): Expense {
  return {
    ...expense,
    category: categories.find((category) => category.id === expense.categoryId) ?? null,
  };
}

function sortExpenses(
  expenses: Expense[],
  sortBy: ExpenseFilters['sortBy'] = 'expenseDate',
  sortDirection: ExpenseFilters['sortDirection'] = 'desc',
) {
  const direction = sortDirection === 'asc' ? 1 : -1;

  return [...expenses].sort((left, right) => {
    if (sortBy === 'amount') {
      return (left.amount - right.amount) * direction;
    }

    const leftValue = new Date(sortBy === 'createdAt' ? left.createdAt : left.expenseDate).getTime();
    const rightValue = new Date(sortBy === 'createdAt' ? right.createdAt : right.expenseDate).getTime();
    return (leftValue - rightValue) * direction;
  });
}

function filterExpenses(expenses: Expense[], filters?: ExpenseFilters) {
  return expenses.filter((expense) => {
    if (filters?.range?.start && expense.expenseDate < filters.range.start) return false;
    if (filters?.range?.end && expense.expenseDate > filters.range.end) return false;
    if (filters?.type && filters.type !== 'all' && (expense.type ?? 'expense') !== filters.type) return false;
    if (filters?.categoryIds?.length && !filters.categoryIds.includes(expense.categoryId ?? '')) return false;
    if (typeof filters?.minAmount === 'number' && expense.amount < filters.minAmount) return false;
    if (typeof filters?.maxAmount === 'number' && expense.amount > filters.maxAmount) return false;
    if (filters?.currency && expense.currency !== filters.currency) return false;
    if (filters?.includeRecurring === false && expense.isRecurring) return false;
    if (filters?.keyword) {
      const keyword = filters.keyword.trim().toLowerCase();
      const haystack = `${expense.description} ${expense.category?.name ?? ''}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

async function hydrateBudgets(rawBudgets?: Budget[]) {
  const [expenses, categories] = await Promise.all([expensesDb.getAll(), getHydratedCategories()]);
  const budgets = rawBudgets ?? (await budgetsDb.getAll());

  return budgets.map((budget) => {
    const spent = expenses
      .filter((expense) => {
        if ((expense.type ?? 'expense') === 'income') return false;
        if (budget.categoryId && expense.categoryId !== budget.categoryId) return false;
        return monthKey(expense.expenseDate) === budget.month;
      })
      .reduce((sum, expense) => sum + expense.amountInPrimaryCurrency, 0);

    return {
      ...budget,
      spent,
      remaining: budget.amount - spent,
      categoryId: budget.categoryId,
      userId: budget.userId,
      currency: budget.currency,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  });
}

function buildTrend(expenses: Expense[], range?: DateRange) {
  const useMonthlyBuckets = range
    ? Math.abs(new Date(range.end).getTime() - new Date(range.start).getTime()) >= 1000 * 60 * 60 * 24 * 90
    : false;

  const buckets = new Map<string, number>();
  for (const expense of expenses) {
    const bucket = useMonthlyBuckets ? expense.expenseDate.slice(0, 7) : expense.expenseDate.slice(0, 10);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + expense.amountInPrimaryCurrency);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucket, total]) => ({ bucket, total }));
}

async function summarizeDashboard(): Promise<DashboardSummary> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();

  const [expenses, categories, budgets] = await Promise.all([
    expensesDb.getAll(),
    getHydratedCategories(),
    hydrateBudgets(),
  ]);
  const hydrated = expenses.map((expense) => withCategory(expense, categories));
  const currentMonthExpenses = filterExpenses(hydrated, { range: { start: monthStart, end: monthEnd }, type: 'expense' });
  const previousMonthExpenses = filterExpenses(hydrated, { range: { start: previousMonthStart, end: previousMonthEnd }, type: 'expense' });

  const totalThisMonth = currentMonthExpenses.reduce((sum, expense) => sum + expense.amountInPrimaryCurrency, 0);
  const totalLastMonth = previousMonthExpenses.reduce((sum, expense) => sum + expense.amountInPrimaryCurrency, 0);
  const trendPercent = totalLastMonth > 0 ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100 : 0;
  const recentExpenses = sortExpenses(hydrated, 'expenseDate', 'desc').slice(0, 12);
  const dailyAverage = currentMonthExpenses.length ? totalThisMonth / Math.max(now.getDate(), 1) : 0;

  const categoryTotals = new Map<string, { category: Category | null; total: number }>();
  for (const expense of currentMonthExpenses) {
    const key = expense.categoryId ?? 'uncategorized';
    const existing = categoryTotals.get(key) ?? { category: expense.category ?? null, total: 0 };
    existing.total += expense.amountInPrimaryCurrency;
    categoryTotals.set(key, existing);
  }

  const topCategoryEntry = Array.from(categoryTotals.values()).sort((left, right) => right.total - left.total)[0] ?? null;
  const currentMonthBudgets = budgets.filter((budget) => budget.month === monthKey(monthStart));
  const totalBudgeted = currentMonthBudgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalBudgetSpent = currentMonthBudgets.reduce((sum, budget) => sum + budget.spent, 0);

  return {
    totalThisMonth,
    totalLastMonth,
    trendPercent,
    dailyAverage,
    topCategory: topCategoryEntry?.category ?? null,
    topCategorySpend: topCategoryEntry?.total ?? 0,
    budgetUsagePercent: totalBudgeted > 0 ? Math.min(100, (totalBudgetSpent / totalBudgeted) * 100) : 0,
    recentExpenses,
  };
}

async function summarizeReport(range?: DateRange, type: ExpenseType | 'all' = 'expense'): Promise<ReportSummary> {
  const [expenses, categories, budgets] = await Promise.all([
    expensesDb.getAll(),
    getHydratedCategories(),
    hydrateBudgets(),
  ]);
  const hydrated = expenses.map((expense) => withCategory(expense, categories));
  const filtered = filterExpenses(hydrated, {
    range,
    type,
    sortBy: 'expenseDate',
    sortDirection: 'desc',
  });

  const totalSpent = filtered.reduce((sum, expense) => sum + expense.amountInPrimaryCurrency, 0);
  const scopedBudgets = type === 'income'
    ? []
    : budgets.filter((budget) => {
        if (!range) return true;
        return budget.month >= monthKey(range.start) && budget.month <= monthKey(range.end);
      });
  const totalBudgeted = scopedBudgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalRemaining = totalBudgeted - totalSpent;

  const categoryMap = new Map<string, ReportSummary['categoryBreakdown'][number]>();
  for (const expense of filtered) {
    const key = expense.categoryId ?? 'uncategorized';
    const current = categoryMap.get(key) ?? {
      categoryId: expense.categoryId ?? null,
      categoryName: expense.category?.name ?? 'Uncategorized',
      total: 0,
      currency: expense.currency,
      color: expense.category?.color ?? null,
      icon: expense.category?.icon ?? null,
    };
    current.total += expense.amountInPrimaryCurrency;
    categoryMap.set(key, current);
  }

  return {
    range: range ?? {
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      end: new Date().toISOString(),
    },
    totalSpent,
    totalBudgeted,
    totalRemaining,
    categoryBreakdown: Array.from(categoryMap.values()).sort((left, right) => right.total - left.total),
    trend: buildTrend(filtered, range),
  };
}

function buildExpenseCsv(expenses: Expense[]) {
  return buildCsv(expenses, [
    { key: 'expenseDate', header: 'Date', formatter: (value) => String(value ?? '') },
    { key: 'description', header: 'Description', formatter: (value) => String(value ?? '') },
    { key: 'category', header: 'Category', formatter: (_value, row) => row.category?.name ?? 'Uncategorized' },
    { key: 'type', header: 'Type', formatter: (value) => String(value ?? 'expense') },
    { key: 'amount', header: 'Amount', formatter: (value) => String(value ?? 0) },
    { key: 'currency', header: 'Currency', formatter: (value) => String(value ?? 'USD') },
    { key: 'receiptUrl', header: 'Receipt', formatter: (value) => String(value ?? '') },
  ]);
}

async function buildUserFromRecords() {
  const profile = await getProfileRecord();
  const preferences = await preferencesDb.get();
  if (!profile || !profile.name.trim()) {
    return null;
  }

  return {
    ...profile,
    preferences,
  } as User;
}

export const localMobileStore = {
  async setupWorkspace(input: { name: string; currency: UserPreferences['currency']; email?: string }) {
    await ensureWorkspaceReady();
    const preferences = await preferencesDb.update({
      currency: input.currency,
      dateFormat: (await getPreferencesRecord()).dateFormat,
      defaultCategoryId: null,
      theme: (await getPreferencesRecord()).theme,
    });

    const profile = await profileDb.createOrUpdate({
      name: input.name,
      email: input.email?.trim() || DEFAULT_EMAIL,
      avatarUrl: null,
    });

    await db.profile.put({
      ...profile,
      preferences,
    });

    await ensureSeedCategories();
    return toSession({ ...profile, preferences });
  },

  async signUp(input: AuthPayload): Promise<AuthSession> {
    return this.setupWorkspace({
      name: input.name?.trim() || input.email.split('@')[0] || 'You',
      currency: 'USD',
      email: input.email,
    });
  },

  async login(_input: AuthPayload): Promise<AuthSession> {
    const session = await this.me();
    if (!session) {
      throw new Error('Sign in at least once on this device before using the offline cache.');
    }
    return session;
  },

  async logout(): Promise<void> {
    // No-op in the local-only build.
  },

  async refresh(): Promise<AuthSession> {
    const session = await this.me();
    if (!session) {
      throw new Error('Sign in and sync your workspace before using the offline cache.');
    }
    return session;
  },

  async me(): Promise<AuthSession | null> {
    const user = await buildUserFromRecords();
    return user ? toSession(user) : null;
  },

  async listExpenses(filters?: ExpenseFilters): Promise<PaginatedExpensesResponse> {
    const user = await getRequiredProfile();
    const categories = await getHydratedCategories();
    const hydrated = (await expensesDb.getAll(filters))
      .filter((expense) => expense.userId === user.id || expense.userId === 'local')
      .map((expense) => withCategory(expense, categories));
    const filtered = filterExpenses(hydrated, filters);
    const sorted = sortExpenses(filtered, filters?.sortBy, filters?.sortDirection);
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? Math.max(sorted.length, 1);
    const start = (page - 1) * pageSize;

    return {
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
    };
  },

  async getExpense(expenseId: string): Promise<Expense> {
    const categories = await getHydratedCategories();
    const expense = (await expensesDb.getAll()).find((item) => item.id === expenseId);
    if (!expense) {
      throw new Error('Expense not found.');
    }
    return withCategory(expense, categories);
  },

  async createExpense(input: ExpenseInput): Promise<Expense> {
    await getRequiredProfile();
    const expense = await expensesDb.create(input);
    const categories = await getHydratedCategories();
    return withCategory(expense, categories);
  },

  async updateExpense(expenseId: string, input: Partial<ExpenseInput>): Promise<Expense> {
    const expense = await expensesDb.update(expenseId, input);
    const categories = await getHydratedCategories();
    return withCategory(expense, categories);
  },

  async removeExpense(expenseId: string): Promise<void> {
    await expensesDb.delete(expenseId);
  },

  async listCategories(): Promise<Category[]> {
    await getRequiredProfile();
    return categoriesDb.getAll();
  },

  async createCategory(input: CategoryInput): Promise<Category> {
    const existing = await categoriesDb.getAll();
    if (existing.some((category) => category.name.trim().toLowerCase() === input.name.trim().toLowerCase())) {
      throw new Error(`"${input.name}" already exists.`);
    }
    return categoriesDb.create(input);
  },

  async updateCategory(categoryId: string, input: Partial<CategoryInput>): Promise<Category> {
    const existing = await categoriesDb.getAll();
    if (
      input.name &&
      existing.some((category) => category.id !== categoryId && category.name.trim().toLowerCase() === input.name.trim().toLowerCase())
    ) {
      throw new Error(`"${input.name}" already exists.`);
    }
    return categoriesDb.update(categoryId, input);
  },

  async removeCategory(categoryId: string): Promise<void> {
    await categoriesDb.delete(categoryId);
  },

  async listBudgets(): Promise<Budget[]> {
    await getRequiredProfile();
    return hydrateBudgets();
  },

  async createBudget(input: BudgetInput): Promise<Budget> {
    await budgetsDb.create(input);
    return (await hydrateBudgets()).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]!;
  },

  async updateBudget(budgetId: string, input: Partial<BudgetInput>): Promise<Budget> {
    await budgetsDb.update(budgetId, input);
    return (await hydrateBudgets()).find((budget) => budget.id === budgetId)!;
  },

  async removeBudget(budgetId: string): Promise<void> {
    await budgetsDb.delete(budgetId);
  },

  async dashboardSummary(): Promise<DashboardSummary> {
    await getRequiredProfile();
    return summarizeDashboard();
  },

  async reportSummary(range?: DateRange, type: ExpenseType | 'all' = 'expense'): Promise<ReportSummary> {
    await getRequiredProfile();
    return summarizeReport(range, type);
  },

  async exportExpensesCsvBlob(filters?: ExpenseFilters): Promise<Blob> {
    const categories = await getHydratedCategories();
    const expenses = sortExpenses(
      filterExpenses((await expensesDb.getAll()).map((expense) => withCategory(expense, categories)), filters),
      filters?.sortBy,
      filters?.sortDirection,
    );
    return new Blob([buildExpenseCsv(expenses)], { type: 'text/csv;charset=utf-8;' });
  },

  async exportExpensesCsvText(filters?: ExpenseFilters): Promise<string> {
    const categories = await getHydratedCategories();
    const expenses = sortExpenses(
      filterExpenses((await expensesDb.getAll()).map((expense) => withCategory(expense, categories)), filters),
      filters?.sortBy,
      filters?.sortDirection,
    );
    return buildExpenseCsv(expenses);
  },

  async exportBackup() {
    return getBackupPayload();
  },

  async restoreBackup(payload: Parameters<typeof restoreBackupPayload>[0]) {
    await restoreBackupPayload(payload);
    return this.me();
  },

  async resetAllData() {
    await resetDatabase();
  },

  async getPreferences(): Promise<UserPreferences> {
    return preferencesDb.get();
  },

  async updatePreferences(input: UserPreferences): Promise<UserPreferences> {
    const preferences = await preferencesDb.update(input);
    const profile = await getProfileRecord();
    if (profile) {
      await db.profile.put({
        ...profile,
        preferences,
      });
    }
    return preferences;
  },

  async getProfile(): Promise<User> {
    const user = await buildUserFromRecords();
    if (!user) {
      throw new Error('Sign in and sync your workspace before using the offline cache.');
    }
    return user;
  },

  async updateProfile(input: ProfileInput): Promise<User> {
    const profile = await profileDb.update(input);
    const preferences = await preferencesDb.get();
    const user = {
      ...profile,
      preferences,
    };
    await db.profile.put(user);
    return user;
  },

  async uploadReceipt(file: File): Promise<string> {
    return fileToDataUrl(file);
  },

  async uploadAvatar(file: File): Promise<string> {
    return fileToDataUrl(file);
  },

  async getWorkspaceSnapshot() {
    const [user, categories, budgets, expenses] = await Promise.all([
      this.getProfile(),
      this.listCategories(),
      this.listBudgets(),
      this.listExpenses(),
    ]);

    return {
      user,
      categories: cloneValue(categories),
      budgets: cloneValue(budgets),
      expenses: cloneValue(expenses.items),
    };
  },
};

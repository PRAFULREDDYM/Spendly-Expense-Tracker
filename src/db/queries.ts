import type {
  Budget,
  BudgetInput,
  Category,
  CategoryInput,
  Expense,
  ExpenseFilters,
  ExpenseInput,
  Group,
  GroupBudget,
  GroupInvite,
  GroupMember,
  ProfileInput,
  RecurringExpense,
  Reminder,
  User,
  UserPreferences,
} from '../types';
import { db, initializeDB, type PreferencesRecord } from './database';

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

async function getCurrentWorkspaceUserId() {
  await initializeDB();
  return (await db.profile.toArray())[0]?.id ?? 'local-user';
}

export async function getProfileRecord() {
  await initializeDB();
  return db.profile.get('local-user');
}

export async function getPreferencesRecord(): Promise<PreferencesRecord> {
  await initializeDB();
  return (await db.preferences.get('local'))!;
}

export const expensesDb = {
  async getAll(filters?: ExpenseFilters) {
    await initializeDB();
    const userId = await getCurrentWorkspaceUserId();
    let all: Expense[];

    if (filters?.range?.start && filters?.range?.end) {
      all = await db.expenses
        .where('expenseDate')
        .between(filters.range.start, filters.range.end, true, true)
        .reverse()
        .toArray();
    } else if (filters?.range?.start) {
      all = await db.expenses.where('expenseDate').aboveOrEqual(filters.range.start).reverse().toArray();
    } else if (filters?.range?.end) {
      all = await db.expenses.where('expenseDate').belowOrEqual(filters.range.end).reverse().toArray();
    } else {
      all = await db.expenses.orderBy('expenseDate').reverse().toArray();
    }

    return all.filter((expense) => {
      if (expense.userId !== userId) return false;
      if (filters?.type && filters.type !== 'all' && (expense.type ?? 'expense') !== filters.type) return false;
      if (filters?.categoryIds?.length && !filters.categoryIds.includes(expense.categoryId ?? '')) return false;
      if (typeof filters?.minAmount === 'number' && expense.amount < filters.minAmount) return false;
      if (typeof filters?.maxAmount === 'number' && expense.amount > filters.maxAmount) return false;
      if (filters?.currency && expense.currency !== filters.currency) return false;
      if (filters?.includeRecurring === false && expense.isRecurring) return false;
      if (filters?.keyword) {
        const keyword = filters.keyword.trim().toLowerCase();
        const haystack = `${expense.description}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  },
  async create(data: ExpenseInput) {
    const id = createId('exp');
    const timestamp = nowIso();
    const preferences = await getPreferencesRecord();
    const expense: Expense = {
      id,
      userId: 'local',
      groupId: data.groupId ?? null,
      amount: Number(data.amount),
      amountInPrimaryCurrency: Number(data.amount),
      categoryId: data.categoryId ?? null,
      currency: data.currency ?? preferences.currency,
      description: data.description.trim(),
      expenseDate: data.expenseDate,
      type: data.type ?? 'expense',
      isRecurring: data.isRecurring ?? false,
      receiptUrl: data.receiptUrl ?? null,
      recurringConfig: data.recurringConfig ?? null,
      category: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.expenses.add(expense);
    return expense;
  },
  async update(id: string, data: Partial<ExpenseInput>) {
    const existing = await db.expenses.get(id);
    if (!existing) throw new Error('Expense not found.');

    const nextExpense: Expense = {
      ...existing,
      ...data,
      amount: data.amount === undefined ? existing.amount : Number(data.amount),
      amountInPrimaryCurrency: data.amount === undefined ? existing.amountInPrimaryCurrency : Number(data.amount),
      groupId: data.groupId === undefined ? existing.groupId : data.groupId,
      categoryId: data.categoryId === undefined ? existing.categoryId : data.categoryId,
      description: data.description === undefined ? existing.description : data.description.trim(),
      updatedAt: nowIso(),
    };

    await db.expenses.put(nextExpense);
    return nextExpense;
  },
  async delete(id: string) {
    await db.expenses.delete(id);
  },
};

export const categoriesDb = {
  async getAll() {
    await initializeDB();
    const userId = await getCurrentWorkspaceUserId();
    return (await db.categories.orderBy('createdAt').toArray()).filter((category) => category.userId === userId);
  },
  async create(data: CategoryInput) {
    const id = createId('cat');
    const timestamp = nowIso();
    const category: Category = {
      id,
      userId: 'local',
      name: data.name.trim(),
      color: data.color,
      icon: data.icon,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.categories.add(category);
    return category;
  },
  async update(id: string, data: Partial<CategoryInput>) {
    const existing = await db.categories.get(id);
    if (!existing) throw new Error('Category not found.');
    const nextCategory: Category = {
      ...existing,
      ...data,
      name: data.name === undefined ? existing.name : data.name.trim(),
      updatedAt: nowIso(),
    };
    await db.categories.put(nextCategory);
    return nextCategory;
  },
  async delete(id: string) {
    await db.transaction('rw', [db.categories, db.expenses, db.budgets, db.preferences], async () => {
      await db.categories.delete(id);
      const expenses = await db.expenses.where('categoryId').equals(id).toArray();
      await Promise.all(expenses.map((expense) => db.expenses.put({ ...expense, categoryId: null, updatedAt: nowIso() })));
      const budgets = await db.budgets.where('categoryId').equals(id).toArray();
      await Promise.all(budgets.map((budget) => db.budgets.delete(budget.id)));
      const preferences = await getPreferencesRecord();
      if (preferences.defaultCategoryId === id) {
        await db.preferences.put({ ...preferences, defaultCategoryId: null });
      }
    });
  },
};

export const budgetsDb = {
  async getAll() {
    await initializeDB();
    const userId = await getCurrentWorkspaceUserId();
    return (await db.budgets.orderBy('month').reverse().toArray()).filter((budget) => budget.userId === userId);
  },
  async create(data: BudgetInput) {
    const id = createId('budget');
    const timestamp = nowIso();
    const budget: Budget = {
      id,
      userId: 'local',
      categoryId: data.categoryId ?? null,
      month: data.month,
      amount: Number(data.amount),
      currency: data.currency,
      spent: 0,
      remaining: Number(data.amount),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.budgets.add(budget);
    return budget;
  },
  async update(id: string, data: Partial<BudgetInput>) {
    const existing = await db.budgets.get(id);
    if (!existing) throw new Error('Budget not found.');
    const nextBudget: Budget = {
      ...existing,
      ...data,
      amount: data.amount === undefined ? existing.amount : Number(data.amount),
      updatedAt: nowIso(),
    };
    await db.budgets.put(nextBudget);
    return nextBudget;
  },
  async delete(id: string) {
    await db.budgets.delete(id);
  },
};

export const preferencesDb = {
  async get() {
    const preferences = await getPreferencesRecord();
    const { id: _id, ...rest } = preferences;
    return rest as UserPreferences;
  },
  async update(data: Partial<UserPreferences>) {
    const current = await getPreferencesRecord();
    const nextPreferences: PreferencesRecord = {
      ...current,
      ...data,
      id: 'local',
    };
    await db.preferences.put(nextPreferences);
    const { id: _id, ...rest } = nextPreferences;
    return rest as UserPreferences;
  },
};

export const profileDb = {
  async get() {
    await initializeDB();
    return (await db.profile.get('local-user')) ?? null;
  },
  async createOrUpdate(input: Pick<User, 'name' | 'email' | 'avatarUrl'>) {
    const existing = await db.profile.get('local-user');
    const now = nowIso();
    const profile: User = existing
      ? {
          ...existing,
          ...input,
          name: input.name.trim(),
          email: input.email.trim(),
          avatarUrl: input.avatarUrl ?? existing.avatarUrl,
          preferences: existing.preferences,
        }
      : {
          id: 'local-user',
          name: input.name.trim(),
          email: input.email.trim(),
          avatarUrl: input.avatarUrl ?? null,
          createdAt: now,
          preferences: await preferencesDb.get(),
        };
    await db.profile.put(profile);
    return profile;
  },
  async update(input: ProfileInput) {
    const existing = await db.profile.get('local-user');
    if (!existing) throw new Error('Profile not found.');
    const profile: User = {
      ...existing,
      avatarUrl: input.avatarUrl === undefined ? existing.avatarUrl : input.avatarUrl,
    };
    await db.profile.put(profile);
    return profile;
  },
  async clear() {
    await db.profile.clear();
  },
};

export async function getBackupPayload() {
  await initializeDB();
  return {
    version: 1,
    exportedAt: nowIso(),
    profile: await db.profile.get('local-user'),
    preferences: await db.preferences.get('local'),
    categories: await db.categories.toArray(),
    budgets: await db.budgets.toArray(),
    expenses: await db.expenses.toArray(),
    groups: await db.groups.toArray(),
    groupMembers: await db.group_members.toArray(),
    groupBudgets: await db.group_budgets.toArray(),
    groupInvites: await db.group_invites.toArray(),
    recurringExpenses: await db.recurring_expenses.toArray(),
    reminders: await db.reminders.toArray(),
  };
}

export async function restoreBackupPayload(payload: {
  profile?: User | null;
  preferences?: PreferencesRecord | UserPreferences | null;
  categories?: Category[];
  budgets?: Budget[];
  expenses?: Expense[];
  groups?: Group[];
  groupMembers?: GroupMember[];
  groupBudgets?: GroupBudget[];
  groupInvites?: GroupInvite[];
  recurringExpenses?: RecurringExpense[];
  reminders?: Reminder[];
}) {
  await db.transaction(
    'rw',
    [
      db.profile,
      db.preferences,
      db.categories,
      db.budgets,
      db.expenses,
      db.groups,
      db.group_members,
      db.group_budgets,
      db.group_invites,
      db.recurring_expenses,
      db.reminders,
    ],
    async () => {
    await db.profile.clear();
    await db.categories.clear();
    await db.budgets.clear();
    await db.expenses.clear();
    await db.preferences.clear();
    await db.groups.clear();
    await db.group_members.clear();
    await db.group_budgets.clear();
    await db.group_invites.clear();
    await db.recurring_expenses.clear();
    await db.reminders.clear();

    await db.preferences.put({
      ...defaultPreferencesFromPayload(payload.preferences),
      id: 'local',
    });

    if (payload.profile) await db.profile.put(payload.profile);
    if (payload.categories?.length) await db.categories.bulkPut(payload.categories);
    if (payload.budgets?.length) await db.budgets.bulkPut(payload.budgets);
    if (payload.expenses?.length) await db.expenses.bulkPut(payload.expenses);
    if (payload.groups?.length) await db.groups.bulkPut(payload.groups);
    if (payload.groupMembers?.length) await db.group_members.bulkPut(payload.groupMembers);
    if (payload.groupBudgets?.length) await db.group_budgets.bulkPut(payload.groupBudgets);
    if (payload.groupInvites?.length) await db.group_invites.bulkPut(payload.groupInvites);
    if (payload.recurringExpenses?.length) await db.recurring_expenses.bulkPut(payload.recurringExpenses);
    if (payload.reminders?.length) await db.reminders.bulkPut(payload.reminders);
  });
}

function defaultPreferencesFromPayload(payload?: PreferencesRecord | UserPreferences | null): PreferencesRecord {
  return {
    id: 'local',
    currency: payload?.currency ?? 'USD',
    dateFormat: payload?.dateFormat ?? 'MM/dd/yyyy',
    defaultCategoryId: payload?.defaultCategoryId ?? null,
    theme: payload?.theme ?? 'system',
  };
}

export async function resetDatabase() {
  await db.delete();
  await db.open();
  await initializeDB();
}

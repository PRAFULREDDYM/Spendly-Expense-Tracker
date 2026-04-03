import type {
  AuthPayload,
  AuthResponse,
  Budget,
  BudgetInput,
  DashboardResponse,
  DateRange,
  DetectedPattern,
  Expense,
  ExpenseFilters,
  ExpenseFiltersResponse,
  ExpenseInput,
  Group,
  GroupBudget,
  GroupBudgetInput,
  GroupInvite,
  ProfileInput,
  PreferencesInput,
  RecurringExpense,
  RecurringExpenseInput,
  Reminder,
  ReportResponse,
  InsightItem,
  User,
  UserPreferences,
} from '../types';
import type { AuthSession } from '../types/domain';
import { cacheGroupBudgets, cacheGroupInvites, cacheGroupMembers, cacheGroups, cacheUpsertExpense } from '../db/cacheSync';
import { db, initializeDB } from '../db/database';
import { groupsStore } from '../services/groupsStore';
import { buildInsights } from '../services/insightEngine';
import { detectRecurringPatterns, recurringStore } from '../services/recurringStore';
import { supabaseStore } from '../services/supabaseStore';

type SuccessResponse = { success: true };

function unwrapSession(response: AuthResponse) {
  return response.session;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function matchesMonth(date: string, month: string) {
  return date.slice(0, 7) === month;
}

function isOfflineError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    typeof navigator !== 'undefined' && navigator.onLine === false
  ) || message.includes('failed to fetch') || message.includes('network') || message.includes('offline') || message.includes('load failed');
}

function mapGroupExpenseToExpense(expense: Awaited<ReturnType<typeof groupsStore.listRecentExpenses>>[number]): Expense {
  return {
    id: expense.id,
    userId: expense.userId,
    groupId: expense.groupId,
    categoryId: expense.categoryId,
    amount: expense.amount,
    currency: expense.currency,
    amountInPrimaryCurrency: expense.amount,
    expenseDate: expense.expenseDate,
    description: expense.description,
    type: expense.type,
    category: null,
    receiptUrl: null,
    isRecurring: false,
    recurringConfig: null,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

async function mapGroupToDomain(groupId: string): Promise<Group> {
  const [group, members, budgets, invites, expenses] = await Promise.all([
    groupsStore.getGroup(groupId),
    groupsStore.listMembers(groupId),
    groupsStore.listBudgets(groupId),
    groupsStore.listActiveInvites(groupId),
    groupsStore.listRecentExpenses(groupId, 1000),
  ]);

  return {
    id: group.id,
    name: group.name,
    createdBy: group.ownerId,
    createdAt: group.createdAt,
    members: members.map((member) => ({
      id: `${member.groupId}:${member.userId}`,
      groupId: member.groupId,
      userId: member.userId,
      role: member.role === 'admin' ? 'member' : member.role,
      joinedAt: member.joinedAt,
      email: member.email,
      name: member.displayName,
      avatarUrl: member.avatarUrl,
    })),
    invites: invites.map((invite) => ({
      id: invite.id,
      groupId: invite.groupId,
      invitedEmail: invite.email ?? '',
      invitedBy: invite.invitedBy,
      token: invite.token,
      accepted: Boolean(invite.acceptedAt),
      createdAt: invite.createdAt,
      shareUrl: groupsStore.buildInviteUrl(invite.token),
    })),
    budgets: budgets.map((budget) => ({
      id: budget.id,
      groupId: budget.groupId,
      name: budget.label,
      amount: budget.amount,
      currency: budget.currency,
      period: 'monthly' as const,
      categoryName: null,
      spent: expenses
        .filter((expense) => expense.type !== 'income' && matchesMonth(expense.expenseDate, budget.month))
        .reduce((sum, expense) => sum + expense.amount, 0),
      createdAt: budget.createdAt,
    })),
  };
}

async function cacheDomainGroups(groups: Group[]) {
  await cacheGroups(groups);
  await cacheGroupMembers(groups.flatMap((group) => group.members ?? []));
  await cacheGroupBudgets(groups.flatMap((group) => group.budgets ?? []));
  await cacheGroupInvites(groups.flatMap((group) => group.invites ?? []));
}

async function readCachedGroups(): Promise<Group[]> {
  await initializeDB();
  const [groups, members, budgets, invites] = await Promise.all([
    db.groups.toArray(),
    db.group_members.toArray(),
    db.group_budgets.toArray(),
    db.group_invites.toArray(),
  ]);

  return groups.map((group) => ({
    ...group,
    members: members.filter((member) => member.groupId === group.id),
    budgets: budgets.filter((budget) => budget.groupId === group.id),
    invites: invites.filter((invite) => invite.groupId === group.id),
  }));
}

export const apiClient = {
  auth: {
    async setup(input: { name: string; currency: UserPreferences['currency']; email?: string }): Promise<AuthSession> {
      return supabaseStore.setupWorkspace(input);
    },
    async loginWithGoogle(redirectPath?: string): Promise<void> {
      return supabaseStore.loginWithGoogle(redirectPath);
    },
    async signUp(input: AuthPayload): Promise<AuthSession> {
      return unwrapSession({ session: await supabaseStore.signUp(input) });
    },
    async login(input: AuthPayload): Promise<AuthSession> {
      return unwrapSession({ session: await supabaseStore.login(input) });
    },
    async logout(): Promise<void> {
      await supabaseStore.logout();
    },
    async refresh(): Promise<AuthSession> {
      return supabaseStore.refresh();
    },
    async me(): Promise<AuthSession | null> {
      return supabaseStore.me();
    },
  },
  expenses: {
    async list(filters?: ExpenseFilters): Promise<ExpenseFiltersResponse> {
      return supabaseStore.listExpenses(filters);
    },
    async get(expenseId: string): Promise<Expense> {
      return supabaseStore.getExpense(expenseId);
    },
    async create(input: ExpenseInput): Promise<Expense> {
      return supabaseStore.createExpense(input);
    },
    async update(expenseId: string, input: Partial<ExpenseInput>): Promise<Expense> {
      return supabaseStore.updateExpense(expenseId, input);
    },
    async remove(expenseId: string): Promise<void> {
      await supabaseStore.removeExpense(expenseId);
    },
  },
  categories: {
    async list() {
      return supabaseStore.listCategories();
    },
    async create(input) {
      return supabaseStore.createCategory(input);
    },
    async update(categoryId, input) {
      return supabaseStore.updateCategory(categoryId, input);
    },
    async remove(categoryId) {
      await supabaseStore.removeCategory(categoryId);
    },
  },
  budgets: {
    async list(): Promise<Budget[]> {
      return supabaseStore.listBudgets();
    },
    async create(input: BudgetInput): Promise<Budget> {
      return supabaseStore.createBudget(input);
    },
    async update(budgetId: string, input: Partial<BudgetInput>): Promise<Budget> {
      return supabaseStore.updateBudget(budgetId, input);
    },
    async remove(budgetId: string): Promise<void> {
      await supabaseStore.removeBudget(budgetId);
    },
  },
  groups: {
    async list(): Promise<Group[]> {
      try {
        const groups = await groupsStore.listGroups();
        const nextGroups = await Promise.all(groups.map((group) => mapGroupToDomain(group.id)));
        await cacheDomainGroups(nextGroups);
        return nextGroups;
      } catch (error) {
        if (!isOfflineError(error)) {
          throw error;
        }
        return readCachedGroups();
      }
    },
    async create(name: string): Promise<Group> {
      const group = await groupsStore.createGroup({
        name,
        currency: 'USD',
        icon: 'users',
      });
      return mapGroupToDomain(group.id);
    },
    async invite(groupId: string, email: string): Promise<GroupInvite> {
      const invite = await groupsStore.createInvite(groupId, { email });
      return {
        id: invite.id,
        groupId: invite.groupId,
        invitedEmail: invite.email ?? email,
        invitedBy: invite.invitedBy,
        token: invite.token,
        accepted: Boolean(invite.acceptedAt),
        createdAt: invite.createdAt,
        shareUrl: groupsStore.buildInviteUrl(invite.token),
      };
    },
    async acceptInvite(token: string): Promise<void> {
      await groupsStore.acceptInvite(token);
    },
    async leave(groupId: string): Promise<void> {
      await groupsStore.leaveGroup(groupId);
    },
    async removeMember(groupId: string, userId: string): Promise<void> {
      await groupsStore.removeMember(groupId, userId);
    },
    async delete(groupId: string): Promise<void> {
      await groupsStore.deleteGroup(groupId);
    },
    async budgets(groupId: string): Promise<GroupBudget[]> {
      try {
        return (await mapGroupToDomain(groupId)).budgets ?? [];
      } catch (error) {
        if (!isOfflineError(error)) {
          throw error;
        }
        return (await readCachedGroups()).find((group) => group.id === groupId)?.budgets ?? [];
      }
    },
    async createBudget(input: GroupBudgetInput): Promise<GroupBudget> {
      const budget = await groupsStore.createBudget(input.groupId, {
        label: input.name,
        month: currentMonthKey(),
        amount: input.amount,
        currency: input.currency,
      });
      return {
        id: budget.id,
        groupId: budget.groupId,
        name: budget.label,
        amount: budget.amount,
        currency: budget.currency,
        period: input.period,
        categoryName: input.categoryName ?? null,
        spent: 0,
        createdAt: budget.createdAt,
      };
    },
    async deleteBudget(budgetId: string): Promise<void> {
      const groups = await groupsStore.listGroups();
      for (const group of groups) {
        const budgets = await groupsStore.listBudgets(group.id);
        if (budgets.some((budget) => budget.id === budgetId)) {
          await groupsStore.deleteBudget(group.id, budgetId);
          return;
        }
      }
      throw new Error('Shared budget not found.');
    },
    async expenses(groupId: string, start: string, end: string): Promise<Expense[]> {
      try {
        const expenses = await groupsStore.listRecentExpenses(groupId, 1000);
        const mapped = expenses
          .filter((expense) => expense.expenseDate >= start && expense.expenseDate <= end)
          .map(mapGroupExpenseToExpense);
        await Promise.all(mapped.map((expense) => cacheUpsertExpense(expense)));
        return mapped;
      } catch (error) {
        if (!isOfflineError(error)) {
          throw error;
        }
        await initializeDB();
        const cached = await db.expenses.where('groupId').equals(groupId).toArray();
        return cached.filter((expense) => expense.expenseDate >= start && expense.expenseDate <= end);
      }
    },
  },
  recurring: {
    async list(): Promise<RecurringExpense[]> {
      return recurringStore.getRecurring();
    },
    async create(input: RecurringExpenseInput): Promise<RecurringExpense> {
      return recurringStore.createRecurring(input);
    },
    async update(id: string, input: Partial<RecurringExpenseInput>): Promise<void> {
      await recurringStore.updateRecurring(id, input);
    },
    async remove(id: string): Promise<void> {
      await recurringStore.deleteRecurring(id);
    },
    async reminders(): Promise<Reminder[]> {
      return recurringStore.getDueReminders();
    },
    async dismissReminder(id: string): Promise<void> {
      await recurringStore.dismissReminder(id);
    },
    async logReminder(id: string, amount?: number): Promise<void> {
      await recurringStore.logReminderExpense(id, amount);
    },
    async detectPatterns(expenses: Expense[]): Promise<DetectedPattern[]> {
      return detectRecurringPatterns(expenses);
    },
    async insights(expenses: Expense[], budgets: Budget[], recurring: RecurringExpense[], reminders: Reminder[]): Promise<InsightItem[]> {
      return buildInsights({
        expenses,
        budgets,
        recurringExpenses: recurring,
        reminders,
      });
    },
  },
  dashboard: {
    async summary(): Promise<DashboardResponse['summary']> {
      return supabaseStore.dashboardSummary();
    },
  },
  reports: {
    async summary(range?: DateRange, type: ExpenseFilters['type'] = 'expense'): Promise<ReportResponse['report']> {
      return supabaseStore.reportSummary(range, type === 'all' ? 'expense' : type ?? 'expense');
    },
    async exportExpensesCsv(filters?: ExpenseFilters): Promise<Blob> {
      return supabaseStore.exportExpensesCsvBlob(filters);
    },
    async exportExpensesCsvString(filters?: ExpenseFilters): Promise<string> {
      return supabaseStore.exportExpensesCsvText(filters);
    },
  },
  preferences: {
    async get(): Promise<UserPreferences> {
      return supabaseStore.getPreferences();
    },
    async update(input: PreferencesInput): Promise<UserPreferences> {
      return supabaseStore.updatePreferences(input);
    },
  },
  profile: {
    async get(): Promise<User> {
      return supabaseStore.getProfile();
    },
    async update(input: ProfileInput): Promise<User> {
      return supabaseStore.updateProfile(input);
    },
  },
  uploads: {
    async uploadReceipt(file: File): Promise<string> {
      return supabaseStore.uploadReceipt(file);
    },
    async uploadAvatar(file: File): Promise<string> {
      return supabaseStore.uploadAvatar(file);
    },
  },
  workspace: {
    async exportBackup() {
      return supabaseStore.exportBackup();
    },
    async restoreBackup(payload: Awaited<ReturnType<typeof supabaseStore.exportBackup>>) {
      return supabaseStore.restoreBackup(payload);
    },
    async deleteAccount() {
      return supabaseStore.deleteAccount();
    },
    async resetAllData() {
      return supabaseStore.resetAllData();
    },
  },
};

export type ApiClient = typeof apiClient;

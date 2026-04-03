import type { Budget, Category, Expense, Group, GroupBudget, GroupInvite, GroupMember, RecurringExpense, Reminder, User, UserPreferences } from '../types';
import { db, initializeDB } from './database';

function toPreferencesRecord(preferences: UserPreferences) {
  return {
    ...preferences,
    id: 'local' as const,
  };
}

export async function cacheWorkspaceSnapshot(input: {
  profile: User;
  preferences: UserPreferences;
  categories: Category[];
  budgets: Budget[];
  expenses: Expense[];
  groups?: Group[];
  groupMembers?: GroupMember[];
  groupBudgets?: GroupBudget[];
  groupInvites?: GroupInvite[];
  recurringExpenses?: RecurringExpense[];
  reminders?: Reminder[];
}) {
  await initializeDB();
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
    await db.preferences.clear();
    await db.categories.clear();
    await db.budgets.clear();
    await db.expenses.clear();
    await db.groups.clear();
    await db.group_members.clear();
    await db.group_budgets.clear();
    await db.group_invites.clear();
    await db.recurring_expenses.clear();
    await db.reminders.clear();

    await db.profile.put({
      ...input.profile,
      preferences: input.preferences,
    });
    await db.preferences.put(toPreferencesRecord(input.preferences));

    if (input.categories.length) {
      await db.categories.bulkPut(input.categories);
    }
    if (input.budgets.length) {
      await db.budgets.bulkPut(input.budgets);
    }
    if (input.expenses.length) {
      await db.expenses.bulkPut(input.expenses.map((expense) => ({ ...expense, category: undefined })));
    }
    if (input.groups?.length) {
      await db.groups.bulkPut(input.groups);
    }
    if (input.groupMembers?.length) {
      await db.group_members.bulkPut(input.groupMembers);
    }
    if (input.groupBudgets?.length) {
      await db.group_budgets.bulkPut(input.groupBudgets);
    }
    if (input.groupInvites?.length) {
      await db.group_invites.bulkPut(input.groupInvites);
    }
    if (input.recurringExpenses?.length) {
      await db.recurring_expenses.bulkPut(input.recurringExpenses);
    }
    if (input.reminders?.length) {
      await db.reminders.bulkPut(input.reminders);
    }
  });
}

export async function cacheSessionUser(profile: User, preferences: UserPreferences) {
  await initializeDB();
  await db.transaction('rw', [db.profile, db.preferences], async () => {
    await db.profile.put({
      ...profile,
      preferences,
    });
    await db.preferences.put(toPreferencesRecord(preferences));
  });
}

export async function cacheCategories(categories: Category[]) {
  await initializeDB();
  await db.transaction('rw', [db.categories], async () => {
    await db.categories.clear();
    if (categories.length) {
      await db.categories.bulkPut(categories);
    }
  });
}

export async function cacheBudgets(budgets: Budget[]) {
  await initializeDB();
  await db.transaction('rw', [db.budgets], async () => {
    await db.budgets.clear();
    if (budgets.length) {
      await db.budgets.bulkPut(budgets);
    }
  });
}

export async function cacheExpenses(expenses: Expense[]) {
  await initializeDB();
  await db.transaction('rw', [db.expenses], async () => {
    await db.expenses.clear();
    if (expenses.length) {
      await db.expenses.bulkPut(expenses.map((expense) => ({ ...expense, category: undefined })));
    }
  });
}

export async function cacheUpsertCategory(category: Category) {
  await initializeDB();
  await db.categories.put(category);
}

export async function cacheRemoveCategory(categoryId: string) {
  await initializeDB();
  await db.transaction('rw', [db.categories, db.expenses, db.budgets, db.preferences], async () => {
    await db.categories.delete(categoryId);

    const expenses = await db.expenses.where('categoryId').equals(categoryId).toArray();
    await Promise.all(expenses.map((expense) => db.expenses.put({ ...expense, categoryId: null, updatedAt: new Date().toISOString() })));

    const budgets = await db.budgets.where('categoryId').equals(categoryId).toArray();
    await Promise.all(budgets.map((budget) => db.budgets.delete(budget.id)));

    const preferences = await db.preferences.get('local');
    if (preferences?.defaultCategoryId === categoryId) {
      await db.preferences.put({ ...preferences, defaultCategoryId: null });
    }
  });
}

export async function cacheUpsertBudget(budget: Budget) {
  await initializeDB();
  await db.budgets.put(budget);
}

export async function cacheRemoveBudget(budgetId: string) {
  await initializeDB();
  await db.budgets.delete(budgetId);
}

export async function cacheUpsertExpense(expense: Expense) {
  await initializeDB();
  await db.expenses.put({ ...expense, category: undefined });
}

export async function cacheRemoveExpense(expenseId: string) {
  await initializeDB();
  await db.expenses.delete(expenseId);
}

export async function clearLocalWorkspaceCache() {
  await initializeDB();
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
    await db.preferences.clear();
    await db.categories.clear();
    await db.budgets.clear();
    await db.expenses.clear();
    await db.groups.clear();
    await db.group_members.clear();
    await db.group_budgets.clear();
    await db.group_invites.clear();
    await db.recurring_expenses.clear();
    await db.reminders.clear();
  });
}

export async function cacheGroups(groups: Group[]) {
  await initializeDB();
  await db.transaction('rw', [db.groups], async () => {
    await db.groups.clear();
    if (groups.length) {
      await db.groups.bulkPut(groups);
    }
  });
}

export async function cacheGroupMembers(members: GroupMember[]) {
  await initializeDB();
  await db.transaction('rw', [db.group_members], async () => {
    await db.group_members.clear();
    if (members.length) {
      await db.group_members.bulkPut(members);
    }
  });
}

export async function cacheGroupBudgets(budgets: GroupBudget[]) {
  await initializeDB();
  await db.transaction('rw', [db.group_budgets], async () => {
    await db.group_budgets.clear();
    if (budgets.length) {
      await db.group_budgets.bulkPut(budgets);
    }
  });
}

export async function cacheGroupInvites(invites: GroupInvite[]) {
  await initializeDB();
  await db.transaction('rw', [db.group_invites], async () => {
    await db.group_invites.clear();
    if (invites.length) {
      await db.group_invites.bulkPut(invites);
    }
  });
}

export async function cacheUpsertGroup(group: Group) {
  await initializeDB();
  await db.groups.put(group);
}

export async function cacheRemoveGroup(groupId: string) {
  await initializeDB();
  await db.transaction('rw', [db.groups, db.group_members, db.group_budgets, db.group_invites, db.expenses], async () => {
    await db.groups.delete(groupId);
    await db.group_members.where('groupId').equals(groupId).delete();
    await db.group_budgets.where('groupId').equals(groupId).delete();
    await db.group_invites.where('groupId').equals(groupId).delete();
    const expenses = await db.expenses.where('groupId').equals(groupId).toArray();
    await Promise.all(expenses.map((expense) => db.expenses.put({ ...expense, groupId: null, updatedAt: new Date().toISOString() })));
  });
}

export async function cacheUpsertGroupMember(member: GroupMember) {
  await initializeDB();
  await db.group_members.put(member);
}

export async function cacheRemoveGroupMember(memberId: string) {
  await initializeDB();
  await db.group_members.delete(memberId);
}

export async function cacheUpsertGroupBudget(budget: GroupBudget) {
  await initializeDB();
  await db.group_budgets.put(budget);
}

export async function cacheRemoveGroupBudget(budgetId: string) {
  await initializeDB();
  await db.group_budgets.delete(budgetId);
}

export async function cacheRecurringExpenses(recurringExpenses: RecurringExpense[]) {
  await initializeDB();
  await db.transaction('rw', [db.recurring_expenses], async () => {
    await db.recurring_expenses.clear();
    if (recurringExpenses.length) {
      await db.recurring_expenses.bulkPut(recurringExpenses);
    }
  });
}

export async function cacheReminders(reminders: Reminder[]) {
  await initializeDB();
  await db.transaction('rw', [db.reminders], async () => {
    await db.reminders.clear();
    if (reminders.length) {
      await db.reminders.bulkPut(reminders);
    }
  });
}

export async function cacheUpsertRecurringExpense(recurringExpense: RecurringExpense) {
  await initializeDB();
  await db.recurring_expenses.put(recurringExpense);
}

export async function cacheRemoveRecurringExpense(recurringExpenseId: string) {
  await initializeDB();
  await db.recurring_expenses.delete(recurringExpenseId);
}

export async function cacheUpsertReminder(reminder: Reminder) {
  await initializeDB();
  await db.reminders.put(reminder);
}

export async function cacheRemoveReminder(reminderId: string) {
  await initializeDB();
  await db.reminders.delete(reminderId);
}

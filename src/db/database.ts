import Dexie, { type Table } from 'dexie';
import type {
  Budget,
  BudgetInput,
  Category,
  CategoryInput,
  Expense,
  ExpenseInput,
  Group,
  GroupBudget,
  GroupInvite,
  GroupMember,
  RecurringExpense,
  Reminder,
  User,
  UserPreferences,
} from '../types';

export interface PreferencesRecord extends UserPreferences {
  id: 'local';
}

export interface AppProfile extends User {}

export type SyncResource =
  | 'expense'
  | 'category'
  | 'budget'
  | 'group'
  | 'groupMember'
  | 'groupBudget'
  | 'groupInvite'
  | 'recurringExpense'
  | 'reminder';
export type SyncOperation = 'create' | 'update' | 'delete';
export type SyncPayload =
  | ExpenseInput
  | Partial<ExpenseInput>
  | CategoryInput
  | Partial<CategoryInput>
  | BudgetInput
  | Partial<BudgetInput>
  | Group
  | Partial<Group>
  | GroupMember
  | Partial<GroupMember>
  | GroupBudget
  | Partial<GroupBudget>
  | GroupInvite
  | Partial<GroupInvite>
  | RecurringExpense
  | Partial<RecurringExpense>
  | Reminder
  | Partial<Reminder>
  | Record<string, unknown>
  | null;

export interface PendingWrite {
  sequence?: number;
  userId: string;
  resource: SyncResource;
  operation: SyncOperation;
  entityId: string;
  payload: SyncPayload;
  createdAt: string;
}

function normalizePendingWrite(row: Record<string, unknown>): PendingWrite {
  const payload = typeof row.payload === 'string'
    ? (() => {
        try {
          return JSON.parse(row.payload as string) as SyncPayload;
        } catch {
          return null;
        }
      })()
    : (row.payload as SyncPayload | undefined) ?? null;

  const legacyTable = row.table as 'expenses' | 'categories' | 'budgets' | undefined;
  const legacyResource =
    row.resource as SyncResource | undefined
    ?? (legacyTable === 'expenses' ? 'expense' : legacyTable === 'categories' ? 'category' : legacyTable === 'budgets' ? 'budget' : undefined);

  return {
    sequence: (row.sequence as number | undefined) ?? (row.id as number | undefined),
    userId:
      (row.userId as string | undefined)
      ?? (payload && typeof payload === 'object'
        ? ((payload as { userId?: unknown; user_id?: unknown; record?: { userId?: unknown; user_id?: unknown } }).userId as string | undefined)
          ?? ((payload as { userId?: unknown; user_id?: unknown; record?: { userId?: unknown; user_id?: unknown } }).user_id as string | undefined)
          ?? ((payload as { record?: { userId?: unknown; user_id?: unknown } }).record?.userId as string | undefined)
          ?? ((payload as { record?: { userId?: unknown; user_id?: unknown } }).record?.user_id as string | undefined)
        : undefined)
      ?? 'local',
    resource: legacyResource ?? 'expense',
    operation: row.operation as SyncOperation,
    entityId:
      (row.entityId as string | undefined)
      ?? (row.recordId as string | undefined)
      ?? (row.record_id as string | undefined)
      ?? '',
    payload,
    createdAt:
      (row.createdAt as string | undefined)
      ?? (row.created_at as string | undefined)
      ?? new Date().toISOString(),
  };
}

export class AppDatabase extends Dexie {
  profile!: Table<AppProfile, string>;
  expenses!: Table<Expense, string>;
  categories!: Table<Category, string>;
  budgets!: Table<Budget, string>;
  groups!: Table<Group, string>;
  group_members!: Table<GroupMember, string>;
  group_budgets!: Table<GroupBudget, string>;
  group_invites!: Table<GroupInvite, string>;
  recurring_expenses!: Table<RecurringExpense, string>;
  reminders!: Table<Reminder, string>;
  preferences!: Table<PreferencesRecord, 'local'>;
  pending_writes!: Table<PendingWrite, number>;

  constructor() {
    super('ExpenseTrackerDB');

    this.version(1).stores({
      profile: 'id, email, createdAt',
      expenses: 'id, userId, expenseDate, type, categoryId, createdAt',
      categories: 'id, userId, name, createdAt',
      budgets: 'id, userId, categoryId, month, createdAt',
      preferences: 'id',
    });

    this.version(2).stores({
      profile: 'id, email, createdAt',
      expenses: 'id, userId, expenseDate, type, categoryId, createdAt, [expenseDate+type]',
      categories: 'id, userId, name, createdAt',
      budgets: 'id, userId, categoryId, month, createdAt',
      preferences: 'id',
    });

    this.version(3).stores({
      profile: 'id, email, createdAt',
      expenses: 'id, userId, expenseDate, type, categoryId, createdAt, [expenseDate+type]',
      categories: 'id, userId, name, createdAt',
      budgets: 'id, userId, categoryId, month, createdAt',
      preferences: 'id',
      pending_writes: '++sequence, userId, resource, operation, entityId, createdAt',
    });

    this.version(4).stores({
      profile: 'id, email, createdAt',
      expenses: 'id, userId, expenseDate, type, categoryId, createdAt, [expenseDate+type]',
      categories: 'id, userId, name, createdAt',
      budgets: 'id, userId, categoryId, month, createdAt',
      preferences: 'id',
      pending_writes: '++sequence, userId, resource, operation, entityId, createdAt',
    }).upgrade(async (tx) => {
      const table = tx.table('pending_writes');
      const rows = await table.toArray();
      if (!rows.length) {
        return;
      }

      await table.clear();
      await table.bulkAdd(rows.map((row) => normalizePendingWrite(row as Record<string, unknown>)));
    });

    this.version(5).stores({
      profile: 'id, email, createdAt',
      expenses: 'id, userId, groupId, expenseDate, type, categoryId, createdAt, [expenseDate+type]',
      categories: 'id, userId, name, createdAt',
      budgets: 'id, userId, categoryId, month, createdAt',
      groups: 'id, createdBy, createdAt',
      group_members: 'id, groupId, userId, joinedAt',
      group_budgets: 'id, groupId, period, createdAt',
      group_invites: 'id, groupId, invitedEmail, accepted, createdAt',
      recurring_expenses: 'id, userId, nextDue, active, createdAt',
      reminders: 'id, userId, dueDate, dismissed, logged, remindedAt',
      preferences: 'id',
      pending_writes: '++sequence, userId, resource, operation, entityId, createdAt',
    });
  }
}

export const db = new AppDatabase();

export const defaultPreferences: PreferencesRecord = {
  id: 'local',
  currency: 'USD',
  dateFormat: 'MM/dd/yyyy',
  defaultCategoryId: null,
  theme: 'system',
};

export async function initializeDB() {
  const preferences = await db.preferences.get('local');
  if (!preferences) {
    await db.preferences.put(defaultPreferences);
  }
}

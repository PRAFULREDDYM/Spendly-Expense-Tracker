import type { DetectedPattern, Expense, RecurringExpense, RecurringExpenseInput, Reminder } from '../types';
import { db, initializeDB, type PendingWrite } from '../db/database';
import {
  cacheRecurringExpenses,
  cacheReminders,
  cacheRemoveRecurringExpense,
  cacheRemoveReminder,
  cacheUpsertRecurringExpense,
  cacheUpsertReminder,
} from '../db/cacheSync';
import { assertSupabaseConfigured, supabase } from '../lib/supabase';
import { notificationService } from './notificationService';
import { registerSyncQueueExecutor, syncQueue } from './syncQueue';
import { supabaseStore } from './supabaseStore';

type RecurringRow = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: RecurringExpense['currency'];
  category_id: string | null;
  frequency: RecurringExpense['frequency'];
  day_of_month: number | null;
  day_of_week: number | null;
  next_due: string;
  last_paid: string | null;
  active: boolean;
  auto_log: boolean;
  reminder_days_before: number;
  created_at: string;
};

type ReminderRow = {
  id: string;
  user_id: string;
  recurring_expense_id: string;
  due_date: string;
  reminded_at: string;
  dismissed: boolean;
  logged: boolean;
};

function isOfflineError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    typeof navigator !== 'undefined' && navigator.onLine === false
  ) || message.includes('failed to fetch') || message.includes('network') || message.includes('offline') || message.includes('load failed');
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function requireUserId() {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    throw new Error('Sign in to continue.');
  }
  return data.session.user.id;
}

function mapRecurring(row: RecurringRow): RecurringExpense {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    amount: Number(row.amount),
    currency: row.currency,
    categoryId: row.category_id,
    frequency: row.frequency,
    dayOfMonth: row.day_of_month,
    dayOfWeek: row.day_of_week,
    nextDue: row.next_due,
    lastPaid: row.last_paid,
    active: row.active,
    autoLog: row.auto_log,
    reminderDaysBefore: row.reminder_days_before,
    createdAt: row.created_at,
  };
}

function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    userId: row.user_id,
    recurringExpenseId: row.recurring_expense_id,
    dueDate: row.due_date,
    remindedAt: row.reminded_at,
    dismissed: row.dismissed,
    logged: row.logged,
  };
}

export function calculateNextDue(
  frequency: RecurringExpense['frequency'],
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
  lastPaid?: string | null,
) {
  const base = lastPaid ? new Date(`${lastPaid}T12:00:00`) : new Date();
  let next = new Date(base);

  switch (frequency) {
    case 'daily':
      next.setDate(base.getDate() + 1);
      break;
    case 'weekly': {
      const target = dayOfWeek ?? base.getDay();
      const diff = (7 + target - base.getDay()) % 7 || 7;
      next.setDate(base.getDate() + diff);
      break;
    }
    case 'yearly':
      next = new Date(base.getFullYear() + 1, base.getMonth(), base.getDate());
      break;
    case 'monthly':
    default: {
      const targetDay = Math.min(31, Math.max(1, dayOfMonth ?? base.getDate()));
      next = new Date(base.getFullYear(), base.getMonth() + 1, Math.min(targetDay, 28));
      const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(targetDay, maxDay));
      break;
    }
  }

  return isoDate(next);
}

function normalizeDescription(description: string) {
  return description
    .toLowerCase()
    .replace(/\$?\d+([.,]\d+)?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectRecurringPatterns(expenses: Expense[]): DetectedPattern[] {
  const groups = new Map<string, Expense[]>();

  for (const expense of expenses) {
    if (expense.type === 'income') continue;
    const key = normalizeDescription(expense.description);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(expense);
    groups.set(key, bucket);
  }

  return Array.from(groups.entries()).flatMap(([key, items]) => {
    if (items.length < 3) return [];
    const ordered = [...items].sort((left, right) => left.expenseDate.localeCompare(right.expenseDate));
    const intervals = ordered.slice(1).map((item, index) => {
      const previous = new Date(ordered[index].expenseDate).getTime();
      return Math.round((new Date(item.expenseDate).getTime() - previous) / (1000 * 60 * 60 * 24));
    });
    const averageInterval = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const stableIntervals = intervals.every((value) => Math.abs(value - averageInterval) <= Math.max(3, averageInterval * 0.35));
    if (!stableIntervals) return [];

    const estimatedFrequency: RecurringExpense['frequency'] =
      averageInterval <= 2 ? 'daily'
        : averageInterval <= 10 ? 'weekly'
          : averageInterval <= 45 ? 'monthly'
            : 'yearly';

    const estimatedAmount = ordered.reduce((sum, item) => sum + item.amount, 0) / ordered.length;
    const lastSeen = ordered[ordered.length - 1]?.expenseDate ?? isoDate(new Date());

    return [{
      name: key.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      estimatedAmount,
      estimatedFrequency,
      lastSeen,
      suggestCreating: true,
      categoryId: ordered[ordered.length - 1]?.categoryId ?? null,
    }];
  });
}

async function composeCachedRecurring() {
  await initializeDB();
  return db.recurring_expenses.toArray();
}

async function composeCachedReminders() {
  await initializeDB();
  return db.reminders.toArray();
}

async function refreshRemoteRecurring() {
  const userId = await requireUserId();
  const [recurringResponse, remindersResponse] = await Promise.all([
    supabase.from('recurring_expenses').select('id,user_id,name,amount,currency,category_id,frequency,day_of_month,day_of_week,next_due,last_paid,active,auto_log,reminder_days_before,created_at').eq('user_id', userId).order('next_due', { ascending: true }),
    supabase.from('reminders').select('id,user_id,recurring_expense_id,due_date,reminded_at,dismissed,logged').eq('user_id', userId).order('due_date', { ascending: true }),
  ]);

  if (recurringResponse.error) throw recurringResponse.error;
  if (remindersResponse.error) throw remindersResponse.error;

  const recurring = (recurringResponse.data ?? []).map((row) => mapRecurring(row as RecurringRow));
  const reminders = (remindersResponse.data ?? []).map((row) => mapReminder(row as ReminderRow));
  await cacheRecurringExpenses(recurring);
  await cacheReminders(reminders);
  return { recurring, reminders };
}

async function createRecurringRemote(row: RecurringRow) {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .insert(row)
    .select('id,user_id,name,amount,currency,category_id,frequency,day_of_month,day_of_week,next_due,last_paid,active,auto_log,reminder_days_before,created_at')
    .single<RecurringRow>();
  if (error) throw error;
  const recurring = mapRecurring(data);
  await cacheUpsertRecurringExpense(recurring);
  await notificationService.scheduleReminder(recurring);
  return recurring;
}

async function ensureReminderRows(recurringExpenses: RecurringExpense[], reminders: Reminder[]) {
  const userId = await requireUserId();
  const today = new Date();
  const nextReminders = [...reminders];

  for (const recurring of recurringExpenses) {
    if (!recurring.active) continue;
    const dueDate = new Date(`${recurring.nextDue}T00:00:00`);
    const reminderStart = new Date(dueDate);
    reminderStart.setDate(reminderStart.getDate() - recurring.reminderDaysBefore);

    const existing = nextReminders.find((reminder) => reminder.recurringExpenseId === recurring.id && reminder.dueDate === recurring.nextDue);
    if (existing) continue;
    if (today < reminderStart && today < dueDate) continue;

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      userId,
      recurringExpenseId: recurring.id,
      dueDate: recurring.nextDue,
      remindedAt: new Date().toISOString(),
      dismissed: false,
      logged: false,
    };

    await cacheUpsertReminder(reminder);
    nextReminders.push(reminder);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await syncQueue.enqueue({
        userId,
        resource: 'reminder',
        operation: 'create',
        entityId: reminder.id,
        payload: reminder,
        createdAt: reminder.remindedAt,
      });
    } else {
      await supabase.from('reminders').insert({
        id: reminder.id,
        user_id: reminder.userId,
        recurring_expense_id: reminder.recurringExpenseId,
        due_date: reminder.dueDate,
        reminded_at: reminder.remindedAt,
        dismissed: reminder.dismissed,
        logged: reminder.logged,
      });
    }
  }

  return nextReminders;
}

registerSyncQueueExecutor({
  recurringExpense: async (write: PendingWrite) => {
    if (write.operation === 'create') {
      await createRecurringRemote(write.payload as RecurringRow);
      return;
    }
    if (write.operation === 'update') {
      const patch = (write.payload ?? {}) as Record<string, unknown>;
      const { data, error } = await supabase
        .from('recurring_expenses')
        .update(patch)
        .eq('id', write.entityId)
        .select('id,user_id,name,amount,currency,category_id,frequency,day_of_month,day_of_week,next_due,last_paid,active,auto_log,reminder_days_before,created_at')
        .single<RecurringRow>();
      if (error) throw error;
      const recurring = mapRecurring(data);
      await cacheUpsertRecurringExpense(recurring);
      await notificationService.scheduleReminder(recurring);
      return;
    }
    await supabase.from('recurring_expenses').delete().eq('id', write.entityId);
    await cacheRemoveRecurringExpense(write.entityId);
    await notificationService.cancelReminder(write.entityId);
  },
  reminder: async (write: PendingWrite) => {
    if (write.operation === 'create') {
      const reminder = write.payload as Reminder;
      const { error } = await supabase.from('reminders').insert({
        id: reminder.id,
        user_id: reminder.userId,
        recurring_expense_id: reminder.recurringExpenseId,
        due_date: reminder.dueDate,
        reminded_at: reminder.remindedAt,
        dismissed: reminder.dismissed,
        logged: reminder.logged,
      });
      if (error) throw error;
      return;
    }
    if (write.operation === 'update') {
      const patch = (write.payload ?? {}) as Record<string, unknown>;
      const { data, error } = await supabase
        .from('reminders')
        .update(patch)
        .eq('id', write.entityId)
        .select('id,user_id,recurring_expense_id,due_date,reminded_at,dismissed,logged')
        .single<ReminderRow>();
      if (error) throw error;
      await cacheUpsertReminder(mapReminder(data));
      return;
    }
    await supabase.from('reminders').delete().eq('id', write.entityId);
    await cacheRemoveReminder(write.entityId);
  },
});

export const recurringStore = {
  async getRecurring(): Promise<RecurringExpense[]> {
    try {
      return (await refreshRemoteRecurring()).recurring;
    } catch (error) {
      if (!isOfflineError(error)) throw error;
      return composeCachedRecurring();
    }
  },

  async createRecurring(input: RecurringExpenseInput): Promise<RecurringExpense> {
    const userId = await requireUserId();
    const recurring: RecurringExpense = {
      id: crypto.randomUUID(),
      userId,
      name: input.name.trim(),
      amount: Number(input.amount),
      currency: input.currency,
      categoryId: input.categoryId ?? null,
      frequency: input.frequency,
      dayOfMonth: input.dayOfMonth ?? null,
      dayOfWeek: input.dayOfWeek ?? null,
      nextDue: input.nextDue ?? calculateNextDue(input.frequency, input.dayOfMonth, input.dayOfWeek, input.lastPaid ?? null),
      lastPaid: input.lastPaid ?? null,
      active: input.active ?? true,
      autoLog: input.autoLog ?? false,
      reminderDaysBefore: input.reminderDaysBefore ?? 1,
      createdAt: new Date().toISOString(),
    };
    await cacheUpsertRecurringExpense(recurring);

    const row: RecurringRow = {
      id: recurring.id,
      user_id: recurring.userId,
      name: recurring.name,
      amount: recurring.amount,
      currency: recurring.currency,
      category_id: recurring.categoryId,
      frequency: recurring.frequency,
      day_of_month: recurring.dayOfMonth,
      day_of_week: recurring.dayOfWeek,
      next_due: recurring.nextDue,
      last_paid: recurring.lastPaid,
      active: recurring.active,
      auto_log: recurring.autoLog,
      reminder_days_before: recurring.reminderDaysBefore,
      created_at: recurring.createdAt,
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await syncQueue.enqueue({
        userId,
        resource: 'recurringExpense',
        operation: 'create',
        entityId: recurring.id,
        payload: row,
        createdAt: recurring.createdAt,
      });
      return recurring;
    }

    try {
      return await createRecurringRemote(row);
    } catch {
      await syncQueue.enqueue({
        userId,
        resource: 'recurringExpense',
        operation: 'create',
        entityId: recurring.id,
        payload: row,
        createdAt: recurring.createdAt,
      });
      return recurring;
    }
  },

  async updateRecurring(id: string, input: Partial<RecurringExpenseInput>): Promise<void> {
    const userId = await requireUserId();
    const existing = await db.recurring_expenses.get(id);
    if (!existing) throw new Error('Recurring expense not found.');

    const nextDue = input.nextDue ?? calculateNextDue(
      input.frequency ?? existing.frequency,
      input.dayOfMonth ?? existing.dayOfMonth,
      input.dayOfWeek ?? existing.dayOfWeek,
      input.lastPaid ?? existing.lastPaid,
    );

    const nextRecurring: RecurringExpense = {
      ...existing,
      name: input.name?.trim() ?? existing.name,
      amount: input.amount === undefined ? existing.amount : Number(input.amount),
      currency: input.currency ?? existing.currency,
      categoryId: input.categoryId === undefined ? existing.categoryId : input.categoryId,
      frequency: input.frequency ?? existing.frequency,
      dayOfMonth: input.dayOfMonth === undefined ? existing.dayOfMonth : input.dayOfMonth,
      dayOfWeek: input.dayOfWeek === undefined ? existing.dayOfWeek : input.dayOfWeek,
      nextDue,
      lastPaid: input.lastPaid === undefined ? existing.lastPaid : input.lastPaid,
      active: input.active ?? existing.active,
      autoLog: input.autoLog ?? existing.autoLog,
      reminderDaysBefore: input.reminderDaysBefore ?? existing.reminderDaysBefore,
    };

    await cacheUpsertRecurringExpense(nextRecurring);
    await notificationService.scheduleReminder(nextRecurring);

    const patch = {
      name: nextRecurring.name,
      amount: nextRecurring.amount,
      currency: nextRecurring.currency,
      category_id: nextRecurring.categoryId,
      frequency: nextRecurring.frequency,
      day_of_month: nextRecurring.dayOfMonth,
      day_of_week: nextRecurring.dayOfWeek,
      next_due: nextRecurring.nextDue,
      last_paid: nextRecurring.lastPaid,
      active: nextRecurring.active,
      auto_log: nextRecurring.autoLog,
      reminder_days_before: nextRecurring.reminderDaysBefore,
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await syncQueue.enqueue({
        userId,
        resource: 'recurringExpense',
        operation: 'update',
        entityId: id,
        payload: patch,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .update(patch)
        .eq('id', id)
        .select('id,user_id,name,amount,currency,category_id,frequency,day_of_month,day_of_week,next_due,last_paid,active,auto_log,reminder_days_before,created_at')
        .single<RecurringRow>();
      if (error) throw error;
      await cacheUpsertRecurringExpense(mapRecurring(data));
    } catch {
      await syncQueue.enqueue({
        userId,
        resource: 'recurringExpense',
        operation: 'update',
        entityId: id,
        payload: patch,
        createdAt: new Date().toISOString(),
      });
    }
  },

  async deleteRecurring(id: string): Promise<void> {
    const userId = await requireUserId();
    await cacheRemoveRecurringExpense(id);
    await notificationService.cancelReminder(id);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await syncQueue.enqueue({
        userId,
        resource: 'recurringExpense',
        operation: 'delete',
        entityId: id,
        payload: null,
        createdAt: new Date().toISOString(),
      });
      return;
    }
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
    if (error) throw error;
  },

  async getDueReminders(): Promise<Reminder[]> {
    const { recurring, reminders } = await (async () => {
      try {
        return await refreshRemoteRecurring();
      } catch (error) {
        if (!isOfflineError(error)) throw error;
        return {
          recurring: await composeCachedRecurring(),
          reminders: await composeCachedReminders(),
        };
      }
    })();

    const nextReminders = await ensureReminderRows(recurring, reminders);
    const recurringMap = new Map(recurring.map((item) => [item.id, item]));
    const today = new Date();

    for (const recurringExpense of recurring) {
      if (!recurringExpense.autoLog || !recurringExpense.active) continue;
      const due = new Date(`${recurringExpense.nextDue}T00:00:00`);
      if (due > today) continue;
      const reminder = nextReminders.find((item) => item.recurringExpenseId === recurringExpense.id && item.dueDate === recurringExpense.nextDue);
      if (reminder?.logged) continue;
      await this.logReminderExpense(reminder?.id ?? '', recurringExpense.amount, recurringExpense);
    }

    return nextReminders.filter((reminder) => {
      const recurringExpense = recurringMap.get(reminder.recurringExpenseId);
      if (!recurringExpense || reminder.dismissed || reminder.logged) return false;
      const due = new Date(`${reminder.dueDate}T00:00:00`);
      const reminderDate = new Date(due);
      reminderDate.setDate(reminderDate.getDate() - recurringExpense.reminderDaysBefore);
      return today >= reminderDate;
    });
  },

  async dismissReminder(id: string): Promise<void> {
    const userId = await requireUserId();
    const reminder = await db.reminders.get(id);
    if (!reminder) return;
    await cacheUpsertReminder({ ...reminder, dismissed: true });
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await syncQueue.enqueue({
        userId,
        resource: 'reminder',
        operation: 'update',
        entityId: id,
        payload: { dismissed: true },
        createdAt: new Date().toISOString(),
      });
      return;
    }
    const { error } = await supabase.from('reminders').update({ dismissed: true }).eq('id', id);
    if (error) throw error;
  },

  async logReminderExpense(reminderId: string, amount?: number, recurringOverride?: RecurringExpense): Promise<void> {
    const reminder = reminderId ? await db.reminders.get(reminderId) : null;
    const recurring = recurringOverride ?? (reminder ? await db.recurring_expenses.get(reminder.recurringExpenseId) : null);
    if (!recurring) return;

    await supabaseStore.createExpense({
      categoryId: recurring.categoryId,
      amount: amount ?? recurring.amount,
      currency: recurring.currency,
      expenseDate: `${recurring.nextDue}T09:00:00.000Z`,
      description: recurring.name,
      type: 'expense',
      receiptUrl: null,
      isRecurring: true,
      recurringConfig: {
        frequency: recurring.frequency,
        interval: 1,
        nextOccurrenceDate: recurring.nextDue,
      },
    });

    const nextDue = calculateNextDue(recurring.frequency, recurring.dayOfMonth, recurring.dayOfWeek, recurring.nextDue);
    await this.updateRecurring(recurring.id, {
      lastPaid: recurring.nextDue,
      nextDue,
    });

    if (reminder) {
      await cacheUpsertReminder({ ...reminder, logged: true, dismissed: true });
      const userId = recurring.userId;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await syncQueue.enqueue({
          userId,
          resource: 'reminder',
          operation: 'update',
          entityId: reminder.id,
          payload: { logged: true, dismissed: true },
          createdAt: new Date().toISOString(),
        });
      } else {
        await supabase.from('reminders').update({ logged: true, dismissed: true }).eq('id', reminder.id);
      }
    }
  },
};

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { RecurringExpense } from '../types';
import { recurringStore } from './recurringStore';

function notificationIdFromRecurring(recurringId: string) {
  return Array.from(recurringId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function toReminderDate(recurring: RecurringExpense) {
  const due = new Date(`${recurring.nextDue}T09:00:00`);
  due.setDate(due.getDate() - Math.max(0, recurring.reminderDaysBefore ?? 0));
  return due;
}

async function ensurePermission() {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const current = await LocalNotifications.checkPermissions().catch(() => ({ display: 'denied' as const }));
  if (current.display === 'granted') {
    return true;
  }

  const requested = await LocalNotifications.requestPermissions().catch(() => ({ display: 'denied' as const }));
  return requested.display === 'granted';
}

export const notificationService = {
  async scheduleReminder(recurring: RecurringExpense) {
    const allowed = await ensurePermission();
    if (!allowed || !recurring.active) {
      return;
    }

    await LocalNotifications.schedule({
      notifications: [{
        id: notificationIdFromRecurring(recurring.id),
        title: recurring.reminderDaysBefore > 0 ? 'Bill due soon' : 'Bill due today',
        body: `${recurring.name} · ${recurring.currency} ${recurring.amount.toFixed(2)}`,
        schedule: {
          at: toReminderDate(recurring),
          allowWhileIdle: true,
        },
        extra: {
          recurringExpenseId: recurring.id,
        },
      }],
    }).catch(() => {});
  },

  async cancelReminder(recurringId: string) {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    await LocalNotifications.cancel({
      notifications: [{ id: notificationIdFromRecurring(recurringId) }],
    }).catch(() => {});
  },

  async rescheduleAll(recurringExpenses?: RecurringExpense[]) {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const allowed = await ensurePermission();
    if (!allowed) {
      return;
    }

    const source = recurringExpenses ?? await recurringStore.getRecurring();
    const active = source.filter((item) => item.active);

    await LocalNotifications.cancel({
      notifications: active.map((item) => ({ id: notificationIdFromRecurring(item.id) })),
    }).catch(() => {});

    for (const recurring of active) {
      await this.scheduleReminder(recurring);
    }
  },
};

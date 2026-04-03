import { resetDatabase } from '../db/queries';
import { localMobileStore } from '../services/localMobileStore';

function isoDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export async function seedDemoWorkspace() {
  await resetDatabase();

  await localMobileStore.setupWorkspace({
    name: 'Alex',
    currency: 'USD',
    email: 'alex@expense-tracker.app',
  });

  const existingCategories = await localMobileStore.listCategories();
  const categoriesByName = new Map(existingCategories.map((category) => [category.name.toLowerCase(), category]));

  const ensureCategory = async (name: string, color: string, icon: string) => {
    const existing = categoriesByName.get(name.toLowerCase());
    if (existing) {
      return existing;
    }

    const created = await localMobileStore.createCategory({ name, color, icon });
    categoriesByName.set(name.toLowerCase(), created);
    return created;
  };

  const transport = await ensureCategory('Transport', '#2B7FFF', 'car');
  const entertainment = await ensureCategory('Entertainment', '#A855F7', 'gamepad-2');
  const groceries = categoriesByName.get('food')!;
  const travel = categoriesByName.get('travel')!;
  const salary = categoriesByName.get('salary')!;
  const shopping = categoriesByName.get('shopping')!;
  const bills = categoriesByName.get('bills')!;

  await Promise.all([
    localMobileStore.createBudget({
      categoryId: groceries.id,
      month: new Date().toISOString().slice(0, 7),
      amount: 520,
      currency: 'USD',
    }),
    localMobileStore.createBudget({
      categoryId: transport.id,
      month: new Date().toISOString().slice(0, 7),
      amount: 180,
      currency: 'USD',
    }),
  ]);

  const expenses = [
    { amount: 2480, description: 'Monthly salary', categoryId: salary.id, type: 'income' as const, expenseDate: isoDate(1) },
    { amount: 84.2, description: 'Weekly groceries', categoryId: groceries.id, type: 'expense' as const, expenseDate: isoDate(0) },
    { amount: 16.5, description: 'Coffee and breakfast', categoryId: groceries.id, type: 'expense' as const, expenseDate: isoDate(1) },
    { amount: 42.8, description: 'Fuel top-up', categoryId: transport.id, type: 'expense' as const, expenseDate: isoDate(2) },
    { amount: 22, description: 'Metro card', categoryId: transport.id, type: 'expense' as const, expenseDate: isoDate(3) },
    { amount: 13.99, description: 'Movie night', categoryId: entertainment.id, type: 'expense' as const, expenseDate: isoDate(4) },
    { amount: 59, description: 'Running shoes', categoryId: shopping.id, type: 'expense' as const, expenseDate: isoDate(5) },
    { amount: 132, description: 'Weekend train', categoryId: travel.id, type: 'expense' as const, expenseDate: isoDate(6) },
    { amount: 74.35, description: 'Utilities bill', categoryId: bills.id, type: 'expense' as const, expenseDate: isoDate(8), isRecurring: true },
    { amount: 91.1, description: 'Supermarket restock', categoryId: groceries.id, type: 'expense' as const, expenseDate: isoDate(10) },
    { amount: 27.4, description: 'Taxi to airport', categoryId: transport.id, type: 'expense' as const, expenseDate: isoDate(12) },
  ];

  await Promise.all(
    expenses.map((expense) =>
      localMobileStore.createExpense({
        amount: expense.amount,
        currency: 'USD',
        description: expense.description,
        categoryId: expense.categoryId,
        expenseDate: expense.expenseDate,
        type: expense.type,
        isRecurring: expense.isRecurring ?? false,
      }),
    ),
  );
}

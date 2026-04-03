import { localMobileStore } from '../services/localMobileStore';
import type { Category, UserPreferences } from '../types';

const DEMO_PARAM = 'demo';
const DEMO_VALUE = 'screenshots';
const SCREEN_PARAM = 'screen';
const DEFAULT_CURRENCY: UserPreferences['currency'] = 'USD';
const WORKSPACE_NAME = 'Alex Carter';
const WORKSPACE_EMAIL = 'alex@playstore.demo';

type ScreenshotScreen = 'dashboard' | 'history' | 'add' | 'analysis' | 'profile';

function isScreenshotScreen(value: string | null): value is ScreenshotScreen {
  return value === 'dashboard' || value === 'history' || value === 'add' || value === 'analysis' || value === 'profile';
}

function getScreenFromPathname(pathname: string): ScreenshotScreen {
  if (pathname.startsWith('/history')) {
    return 'history';
  }

  if (pathname.startsWith('/quick-add') || pathname.startsWith('/watch-add')) {
    return 'add';
  }

  if (pathname.startsWith('/analysis')) {
    return 'analysis';
  }

  if (pathname.startsWith('/profile')) {
    return 'profile';
  }

  return 'dashboard';
}

function buildIsoDate(daysAgo: number, hours = 12, minutes = 0) {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonthIsoFrom(daysAhead: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString();
}

async function ensureCategory(
  categoriesByName: Map<string, Category>,
  input: { name: string; color: string; icon: string },
) {
  const existing = categoriesByName.get(input.name.toLowerCase());
  if (existing) {
    return existing;
  }

  const created = await localMobileStore.createCategory(input);
  categoriesByName.set(created.name.toLowerCase(), created);
  return created;
}

async function seedScreenshotWorkspace() {
  await localMobileStore.resetAllData();
  await localMobileStore.setupWorkspace({
    name: WORKSPACE_NAME,
    currency: DEFAULT_CURRENCY,
    email: WORKSPACE_EMAIL,
  });

  const seededCategories = await localMobileStore.listCategories();
  const categoriesByName = new Map(seededCategories.map((category) => [category.name.toLowerCase(), category]));

  const subscriptions = await ensureCategory(categoriesByName, {
    name: 'Subscriptions',
    color: '#A855F7',
    icon: 'tv',
  });
  const transport = await ensureCategory(categoriesByName, {
    name: 'Transport',
    color: '#14B8A6',
    icon: 'car',
  });

  const food = categoriesByName.get('food');
  const shopping = categoriesByName.get('shopping');
  const travel = categoriesByName.get('travel');
  const bills = categoriesByName.get('bills');
  const salary = categoriesByName.get('salary');

  if (!food || !shopping || !travel || !bills || !salary) {
    throw new Error('Could not prepare seeded categories for screenshots.');
  }

  await localMobileStore.updatePreferences({
    currency: DEFAULT_CURRENCY,
    dateFormat: 'MM/dd/yyyy',
    defaultCategoryId: food.id,
    theme: 'dark',
  });

  await Promise.all([
    localMobileStore.createBudget({
      categoryId: food.id,
      month: currentMonthKey(),
      amount: 650,
      currency: DEFAULT_CURRENCY,
    }),
    localMobileStore.createBudget({
      categoryId: bills.id,
      month: currentMonthKey(),
      amount: 1700,
      currency: DEFAULT_CURRENCY,
    }),
    localMobileStore.createBudget({
      categoryId: travel.id,
      month: currentMonthKey(),
      amount: 400,
      currency: DEFAULT_CURRENCY,
    }),
  ]);

  const expenses = [
    {
      amount: 4800,
      currency: DEFAULT_CURRENCY,
      categoryId: salary.id,
      description: 'Product design salary',
      expenseDate: buildIsoDate(2, 9, 15),
      type: 'income' as const,
      isRecurring: true,
      recurringConfig: {
        frequency: 'monthly' as const,
        interval: 1,
        nextOccurrenceDate: nextMonthIsoFrom(28),
      },
    },
    {
      amount: 1450,
      currency: DEFAULT_CURRENCY,
      categoryId: bills.id,
      description: 'Apartment rent',
      expenseDate: buildIsoDate(1, 8, 30),
      type: 'expense' as const,
      isRecurring: true,
      recurringConfig: {
        frequency: 'monthly' as const,
        interval: 1,
        nextOccurrenceDate: nextMonthIsoFrom(27),
      },
    },
    {
      amount: 86.45,
      currency: DEFAULT_CURRENCY,
      categoryId: food.id,
      description: 'Weekly groceries',
      expenseDate: buildIsoDate(0, 18, 10),
      type: 'expense' as const,
      isRecurring: false,
      recurringConfig: null,
    },
    {
      amount: 24.5,
      currency: DEFAULT_CURRENCY,
      categoryId: transport.id,
      description: 'Ride share to downtown',
      expenseDate: buildIsoDate(0, 8, 45),
      type: 'expense' as const,
      isRecurring: false,
      recurringConfig: null,
    },
    {
      amount: 54.2,
      currency: DEFAULT_CURRENCY,
      categoryId: shopping.id,
      description: 'Running shorts',
      expenseDate: buildIsoDate(3, 13, 25),
      type: 'expense' as const,
      isRecurring: false,
      recurringConfig: null,
    },
    {
      amount: 18.99,
      currency: DEFAULT_CURRENCY,
      categoryId: subscriptions.id,
      description: 'Music subscription',
      expenseDate: buildIsoDate(5, 7, 20),
      type: 'expense' as const,
      isRecurring: true,
      recurringConfig: {
        frequency: 'monthly' as const,
        interval: 1,
        nextOccurrenceDate: nextMonthIsoFrom(6),
      },
    },
    {
      amount: 132.75,
      currency: DEFAULT_CURRENCY,
      categoryId: travel.id,
      description: 'Weekend train tickets',
      expenseDate: buildIsoDate(6, 16, 40),
      type: 'expense' as const,
      isRecurring: false,
      recurringConfig: null,
    },
    {
      amount: 42,
      currency: DEFAULT_CURRENCY,
      categoryId: food.id,
      description: 'Team lunch',
      expenseDate: buildIsoDate(8, 12, 5),
      type: 'expense' as const,
      isRecurring: false,
      recurringConfig: null,
    },
  ];

  for (const expense of expenses) {
    await localMobileStore.createExpense({
      ...expense,
      receiptUrl: null,
    });
  }
}

export function getPlayStoreScreenshotMode() {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get(DEMO_PARAM) !== DEMO_VALUE) {
    return null;
  }

  const screen = params.get(SCREEN_PARAM);
  return {
    screen: isScreenshotScreen(screen) ? screen : getScreenFromPathname(window.location.pathname),
  } satisfies { screen: ScreenshotScreen };
}

export async function maybeSeedPlayStoreScreenshots() {
  const mode = getPlayStoreScreenshotMode();
  if (!mode || typeof window === 'undefined') {
    return null;
  }

  localStorage.setItem('onboarding_complete', 'true');
  await seedScreenshotWorkspace();

  const metadata = {
    mode: DEMO_VALUE,
    screen: mode.screen,
    seededAt: new Date().toISOString(),
  };

  document.documentElement.dataset.screenshotMode = DEMO_VALUE;
  document.documentElement.dataset.screenshotScreen = mode.screen;
  (window as Window & { __EXPENSE_TRACKER_SCREENSHOT__?: typeof metadata }).__EXPENSE_TRACKER_SCREENSHOT__ = metadata;

  return metadata;
}

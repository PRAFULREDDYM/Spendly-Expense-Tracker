export const supportedCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'SGD'] as const;
export type CurrencyCode = (typeof supportedCurrencies)[number];

export const expenseTypes = ['expense', 'income'] as const;
export type ExpenseType = (typeof expenseTypes)[number];
export type ExpenseFilterType = ExpenseType | 'all';

export const themeModes = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof themeModes)[number];

export const recurrenceFrequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type RecurrenceFrequency = (typeof recurrenceFrequencies)[number];
export type GroupMemberRole = 'owner' | 'member';
export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';
export type InsightType =
  | 'UPCOMING_BILL'
  | 'MISSED_PAYMENT'
  | 'SPENDING_SPIKE'
  | 'SAVING_STREAK'
  | 'UNUSUAL_EXPENSE'
  | 'MONTHLY_FORECAST'
  | 'DETECTED_PATTERN';

export interface DateRange {
  start: string;
  end: string;
}

export interface UserPreferences {
  currency: CurrencyCode;
  dateFormat: string;
  defaultCategoryId: string | null;
  theme: ThemeMode;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
  preferences: UserPreferences;
}

export interface AuthSession {
  user: User;
  expiresAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  joinedAt: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  invitedEmail: string;
  invitedBy: string;
  token: string;
  accepted: boolean;
  createdAt: string;
  shareUrl?: string;
}

export interface GroupBudget {
  id: string;
  groupId: string;
  name: string;
  amount: number;
  currency: CurrencyCode;
  period: BudgetPeriod;
  categoryName: string | null;
  spent: number;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  members: GroupMember[];
  invites?: GroupInvite[];
  budgets?: GroupBudget[];
}

export interface RecurringConfig {
  frequency: RecurrenceFrequency;
  interval: number;
  nextOccurrenceDate: string;
}

export interface Expense {
  id: string;
  userId: string;
  groupId?: string | null;
  type?: ExpenseType;
  categoryId: string | null;
  amount: number;
  currency: CurrencyCode;
  amountInPrimaryCurrency: number;
  expenseDate: string;
  description: string;
  category?: Category | null;
  receiptUrl: string | null;
  isRecurring: boolean;
  recurringConfig: RecurringConfig | null;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string | null;
  month: string;
  amount: number;
  currency: CurrencyCode;
  spent: number;
  remaining: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringExpense {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: CurrencyCode;
  categoryId: string | null;
  frequency: RecurrenceFrequency;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  nextDue: string;
  lastPaid: string | null;
  active: boolean;
  autoLog: boolean;
  reminderDaysBefore: number;
  createdAt: string;
}

export interface Reminder {
  id: string;
  userId: string;
  recurringExpenseId: string;
  dueDate: string;
  dismissed: boolean;
  logged: boolean;
  remindedAt: string;
}

export interface DetectedPattern {
  name: string;
  estimatedAmount: number;
  estimatedFrequency: RecurrenceFrequency;
  lastSeen: string;
  suggestCreating: boolean;
  categoryId?: string | null;
}

export interface InsightAction {
  label: string;
  intent?: 'primary' | 'secondary' | 'danger';
  payload?: Record<string, unknown>;
}

export interface InsightItem {
  id: string;
  type: InsightType;
  title: string;
  detail: string;
  color: 'accent' | 'green' | 'amber' | 'red';
  icon: string;
  actionLabel?: string;
  secondaryActionLabel?: string;
  action?: InsightAction;
  secondaryAction?: InsightAction;
}

export interface DashboardSummary {
  totalThisMonth: number;
  totalLastMonth: number;
  trendPercent: number;
  dailyAverage: number;
  topCategory: Category | null;
  topCategorySpend: number;
  budgetUsagePercent: number;
  recentExpenses: Expense[];
}

export interface CategorySpend {
  categoryId: string | null;
  categoryName: string;
  total: number;
  currency: CurrencyCode;
  color: string | null;
  icon: string | null;
}

export interface SpendingTrendPoint {
  bucket: string;
  total: number;
}

export interface ReportSummary {
  range: DateRange;
  totalSpent: number;
  totalBudgeted: number;
  totalRemaining: number;
  categoryBreakdown: CategorySpend[];
  trend: SpendingTrendPoint[];
}

export interface ExpenseFilters {
  range?: Partial<DateRange>;
  type?: ExpenseFilterType;
  categoryIds?: string[];
  minAmount?: number;
  maxAmount?: number;
  keyword?: string;
  currency?: CurrencyCode;
  includeRecurring?: boolean;
  sortBy?: 'expenseDate' | 'amount' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

import type {
  AuthSession,
  Budget,
  BudgetPeriod,
  Category,
  DetectedPattern,
  DashboardSummary,
  Expense,
  ExpenseFilters,
  ExpenseType,
  Group,
  GroupBudget,
  GroupInvite,
  GroupMember,
  InsightItem,
  RecurringExpense,
  Reminder,
  ReportSummary,
  ThemeMode,
  User,
  UserPreferences,
} from './domain';

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AuthPayload {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  session: AuthSession;
}

export interface PaginatedExpensesResponse {
  items: Expense[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExpenseInput {
  categoryId: string | null;
  groupId?: string | null;
  amount: number;
  currency: Expense['currency'];
  expenseDate: string;
  description: string;
  type?: ExpenseType;
  receiptUrl?: string | null;
  isRecurring?: boolean;
  recurringConfig?: Expense['recurringConfig'];
}

export interface CategoryInput {
  name: string;
  color: string;
  icon: string;
}

export interface BudgetInput {
  categoryId: string | null;
  month: string;
  amount: number;
  currency: Budget['currency'];
}

export interface GroupBudgetInput {
  groupId: string;
  name: string;
  amount: number;
  currency: GroupBudget['currency'];
  period: BudgetPeriod;
  categoryName?: string | null;
}

export interface RecurringExpenseInput {
  name: string;
  amount: number;
  currency: RecurringExpense['currency'];
  categoryId?: string | null;
  frequency: RecurringExpense['frequency'];
  dayOfMonth?: number | null;
  dayOfWeek?: number | null;
  nextDue?: string;
  lastPaid?: string | null;
  active?: boolean;
  autoLog?: boolean;
  reminderDaysBefore?: number;
}

export interface PreferencesInput extends UserPreferences {}

export interface ProfileInput {
  avatarUrl?: string | null;
}

export interface ProfileResponse {
  user: User;
}

export interface DashboardResponse {
  summary: DashboardSummary;
}

export interface CategoriesResponse {
  items: Category[];
}

export interface BudgetsResponse {
  items: Budget[];
}

export interface ExpenseFiltersResponse extends PaginatedExpensesResponse {}

export interface ReportResponse {
  report: ReportSummary;
}

export interface CsvExportRequest extends ExpenseFilters {}

export interface GroupResponse {
  group: Group;
}

export interface GroupsResponse {
  items: Group[];
}

export interface GroupBudgetsResponse {
  items: GroupBudget[];
}

export interface GroupInvitesResponse {
  items: GroupInvite[];
}

export interface GroupMembersResponse {
  items: GroupMember[];
}

export interface RecurringResponse {
  items: RecurringExpense[];
}

export interface RemindersResponse {
  items: Reminder[];
}

export interface InsightsResponse {
  items: InsightItem[];
}

export interface DetectedPatternsResponse {
  items: DetectedPattern[];
}

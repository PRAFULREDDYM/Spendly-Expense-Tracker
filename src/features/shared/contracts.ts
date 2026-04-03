import type {
  Budget,
  BudgetInput,
  Category,
  CategoryInput,
  CsvExportRequest,
  DashboardSummary,
  Expense,
  ExpenseFilters,
  ExpenseInput,
  PaginatedExpensesResponse,
  PreferencesInput,
  ReportSummary,
} from '../../types';

export interface ExpenseCrudPort {
  listExpenses(filters: ExpenseFilters): Promise<PaginatedExpensesResponse>;
  createExpense(input: ExpenseInput): Promise<Expense>;
  updateExpense(id: string, input: ExpenseInput): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
}

export interface CategoryPort {
  listCategories(): Promise<Category[]>;
  createCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: string, input: CategoryInput): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
}

export interface BudgetPort {
  listBudgets(): Promise<Budget[]>;
  createBudget(input: BudgetInput): Promise<Budget>;
  updateBudget(id: string, input: BudgetInput): Promise<Budget>;
  deleteBudget(id: string): Promise<void>;
}

export interface ReportPort {
  getDashboardSummary(): Promise<DashboardSummary>;
  getReportSummary(request: CsvExportRequest): Promise<ReportSummary>;
  exportExpensesCsv(request: CsvExportRequest): Promise<string>;
}

export interface PreferencesPort {
  getPreferences(): Promise<PreferencesInput>;
  updatePreferences(input: PreferencesInput): Promise<PreferencesInput>;
}

export interface ExpenseViewModel {
  expense: Expense;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string | null;
  formattedAmount: string;
}

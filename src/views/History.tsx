import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Download, MoreHorizontal, Search, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Category, Expense, ExpenseFilters, UserPreferences } from '../types';
import {
  CategoryPills,
  EmptyState,
  PageShell,
  prettyCurrency,
  prettyDate,
  prettyRange,
  type DateRangeValue,
} from '../components/shell';
import { buildDefaultRange, monthRange } from '../components/shell';
import {
  formatHistoryDateLabel,
  getCategoryColor,
  getMerchantIcon,
  groupExpensesByDate,
  withAlpha,
} from '../lib/ui';
import { formatCategory } from '../components/ui/categoryIcons';

export interface HistoryFiltersState {
  query: string;
  type: ExpenseFilters['type'];
  categoryId: string | null;
  range: DateRangeValue;
  minAmount: string;
  maxAmount: string;
}

export interface HistoryViewProps {
  expenses?: Expense[];
  categories?: Category[];
  preferences?: UserPreferences | null;
  filters?: HistoryFiltersState;
  isLoading?: boolean;
  totalCount?: number;
  isExportingCsv?: boolean;
  headerAccessory?: React.ReactNode;
  onOpenExpenseComposer?: () => void;
  onFiltersChange?: (filters: HistoryFiltersState) => void;
  onExportCsv?: () => void;
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (expense: Expense) => Promise<void> | void;
  deletingExpenseId?: string | null;
}

const rangePills = [
  { key: 'all', label: 'All' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
] as const;

const typePills: Array<{ key: NonNullable<ExpenseFilters['type']>; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expenses' },
  { key: 'income', label: 'Income' },
];

function createYearRange(): DateRangeValue {
  const now = new Date();
  return {
    preset: 'custom',
    start: `${now.getFullYear()}-01-01`,
    end: `${now.getFullYear()}-12-31`,
  };
}

function getActiveRangeKey(range: DateRangeValue) {
  const week = buildDefaultRange();
  const month = monthRange();
  const year = createYearRange();

  if (range.start === week.start && range.end === week.end) return 'week';
  if (range.start === month.start && range.end === month.end) return 'month';
  if (range.start === year.start && range.end === year.end) return 'year';
  return 'all';
}

function buildRecentDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      key: date.toISOString().slice(0, 10),
      day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date).slice(0, 2),
      date: date.getDate(),
      isToday: index === 6,
    };
  });
}

function buildRangeDays(range: DateRangeValue) {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return buildRecentDays();
  }

  // Keep the strip compact, but anchored to the selected range.
  const totalDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const daysToShow = Math.min(7, totalDays);
  const firstVisible = new Date(end);
  firstVisible.setDate(end.getDate() - (daysToShow - 1));

  return Array.from({ length: daysToShow }, (_, index) => {
    const date = new Date(firstVisible);
    date.setDate(firstVisible.getDate() + index);
    return {
      key: date.toISOString().slice(0, 10),
      day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date).slice(0, 2),
      date: date.getDate(),
      isToday: date.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10),
    };
  });
}

function HistoryRow({
  expense,
  onDeleteExpense,
  onEditExpense,
  deleting,
}: {
  key?: React.Key;
  expense: Expense;
  onDeleteExpense?: (expense: Expense) => Promise<void> | void;
  onEditExpense?: (expense: Expense) => void;
  deleting?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const rawCategoryName = expense.category?.name ?? 'Uncategorized';
  const categoryName = formatCategory(rawCategoryName);
  const merchant = getMerchantIcon(expense.description, rawCategoryName);
  const isIncome = expense.type === 'income';
  const amountTone = isIncome ? 'var(--green)' : 'var(--red)';
  const deletingNow = deleting || isDeleting;

  return (
    <div className="transaction-row group relative overflow-visible border-b border-outline/10 last:border-b-0">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative flex min-h-16 items-center gap-3 bg-transparent py-3"
      >
        <button
          type="button"
          onClick={() => onEditExpense?.(expense)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: merchant.background, color: merchant.color }}>
            <span className="text-sm font-semibold">{merchant.label}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="transaction-name truncate text-sm font-medium text-on-surface">{expense.description || 'Untitled expense'}</p>
              {expense.isRecurring && (
                <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ backgroundColor: 'var(--amber-soft)', color: 'var(--amber)' }}>
                  Recurring
                </span>
              )}
            </div>
            <p className="transaction-meta truncate text-xs text-outline">
              {categoryName} · {prettyDate(expense.expenseDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="transaction-amount text-sm font-semibold" style={{ color: amountTone }}>
              {isIncome ? '+' : ''}
              {prettyCurrency(expense.amount, expense.currency)}
            </p>
            <p className="text-[11px] text-outline">{expense.currency}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirmDelete(false);
            setMenuOpen((current) => !current);
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant opacity-100 transition hover:bg-surface-container sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          aria-label="Open transaction actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        <AnimatePresence>
          {menuOpen && !confirmDelete ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              className="absolute right-0 top-[calc(100%-4px)] z-20 w-44 rounded-[var(--radius-md)] border border-outline/10 bg-[var(--bg-elevated)] p-2 shadow-[var(--shadow)]"
            >
              <button type="button" onClick={() => { setMenuOpen(false); onEditExpense?.(expense); }} className="flex w-full rounded-xl px-3 py-2 text-sm text-on-surface hover:bg-white/5">
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
                className="flex w-full rounded-xl px-3 py-2 text-sm text-error hover:bg-white/5"
              >
                Delete
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onEditExpense?.(expense); }} className="flex w-full rounded-xl px-3 py-2 text-sm text-on-surface hover:bg-white/5">
                {expense.isRecurring ? 'Edit recurring' : 'Mark as recurring'}
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {confirmDelete ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-3 flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-error/20 bg-error/5 px-3 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-on-surface">Delete this expense?</p>
              <p className="text-xs text-on-surface-variant">{expense.description || 'Untitled expense'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deletingNow}
                className="rounded-full px-3 py-2 text-xs font-semibold text-on-surface-variant transition hover:bg-surface-container disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (deletingNow) {
                    return;
                  }

                  setIsDeleting(true);
                  try {
                    await onDeleteExpense?.(expense);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={deletingNow}
                className="inline-flex items-center gap-1 rounded-full bg-error px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletingNow ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function HistoryView({
  expenses = [],
  categories = [],
  preferences,
  filters,
  isLoading = false,
  totalCount,
  isExportingCsv = false,
  headerAccessory,
  onOpenExpenseComposer,
  onFiltersChange,
  onExportCsv,
  onEditExpense,
  onDeleteExpense,
  deletingExpenseId = null,
}: HistoryViewProps = {}) {
  const currentFilters = filters ?? {
    query: '',
    type: 'all' as const,
    categoryId: null,
    range: buildDefaultRange(),
    minAmount: '',
    maxAmount: '',
  };
  const activeRangeKey = getActiveRangeKey(currentFilters.range);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const dayRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dateStrip = useMemo(() => buildRangeDays(currentFilters.range), [currentFilters.range.end, currentFilters.range.start]);
  const visibleExpenses = useMemo(
    () => (selectedDay ? expenses.filter((expense) => expense.expenseDate.slice(0, 10) === selectedDay) : expenses),
    [expenses, selectedDay],
  );
  const groupedExpenses = useMemo(() => groupExpensesByDate(visibleExpenses), [visibleExpenses]);
  const preferenceCurrency = preferences?.currency ?? 'USD';
  const getAmountInPreferenceCurrency = (expense: Expense) => expense.amountInPrimaryCurrency || expense.amount;
  const total = visibleExpenses.reduce((sum, expense) => sum + getAmountInPreferenceCurrency(expense), 0);
  const maxDailyTotal = Math.max(
    ...groupedExpenses.map((group) => Math.abs(group.items.reduce((sum, item) => sum + getAmountInPreferenceCurrency(item), 0))),
    1,
  );

  useEffect(() => {
    const target = selectedDay ? dayRefs.current[selectedDay] : dayRefs.current[dateStrip[dateStrip.length - 1]?.key];
    target?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [dateStrip, selectedDay]);

  useEffect(() => {
    // Reset day-level filter when the global date range changes.
    setSelectedDay(null);
  }, [currentFilters.range.end, currentFilters.range.start]);

  const handleDeleteExpense = async (expense: Expense) => {
    if (pendingDeleteId === expense.id || deletingExpenseId === expense.id) {
      return;
    }

    setPendingDeleteId(expense.id);
    try {
      await onDeleteExpense?.(expense);
    } finally {
      setPendingDeleteId((current) => (current === expense.id ? null : current));
    }
  };

  return (
    <PageShell
      title="History"
      subtitle="Search, filter, and review your transaction timeline."
      headerAccessory={headerAccessory}
    >
      <section className="space-y-4">
        <div className="search-bar input-shell flex items-center gap-3">
          <Search className="h-4 w-4 text-outline" />
          <input
            value={currentFilters.query}
            onChange={(event) => onFiltersChange?.({ ...currentFilters, query: event.target.value })}
            placeholder="Search transactions"
            className="h-full w-full bg-transparent text-sm outline-none"
          />
        </div>

        <div className="filter-pills-row horizontal-scroll flex gap-1 overflow-x-auto hide-scrollbar">
          {typePills.map((pill) => (
            <motion.button
              key={pill.key}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => onFiltersChange?.({ ...currentFilters, type: pill.key })}
              className="pill-filter shrink-0"
              style={{
                background: currentFilters.type === pill.key ? 'var(--accent)' : 'transparent',
                color: currentFilters.type === pill.key ? '#fff' : 'var(--text-2)',
              }}
            >
              {pill.label}
            </motion.button>
          ))}
        </div>

        <div className="filter-pills-row horizontal-scroll flex gap-1 overflow-x-auto hide-scrollbar">
          {rangePills.map((pill) => (
            <motion.button
              key={pill.key}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                const nextRange =
                  pill.key === 'week'
                    ? buildDefaultRange()
                    : pill.key === 'month'
                      ? monthRange()
                      : pill.key === 'year'
                        ? createYearRange()
                        : { ...currentFilters.range, preset: 'custom' as const };
                onFiltersChange?.({ ...currentFilters, range: pill.key === 'all' ? currentFilters.range : nextRange });
              }}
              className="pill-filter shrink-0"
              style={{
                background: activeRangeKey === pill.key ? 'var(--accent)' : 'transparent',
                color: activeRangeKey === pill.key ? '#fff' : 'var(--text-2)',
              }}
            >
              {pill.label}
            </motion.button>
          ))}
        </div>

        <div ref={scrubberRef} className="date-scrubber horizontal-scroll flex gap-2 overflow-x-auto hide-scrollbar">
          {dateStrip.map((day) => {
            const active = day.key === selectedDay;
            return (
              <motion.button
                whileTap={{ scale: 0.96 }}
                key={day.key}
                ref={(node) => {
                  dayRefs.current[day.key] = node;
                }}
                type="button"
                onClick={() => setSelectedDay((current) => (current === day.key ? null : day.key))}
                className="date-scrubber-item flex h-11 w-7 shrink-0 flex-col items-center justify-center rounded-[14px] text-center"
                style={{
                  width: 44,
                  backgroundColor: active ? 'var(--accent)' : 'var(--bg-card)',
                  color: active ? '#fff' : 'var(--text-2)',
                }}
              >
                <span className="day-name text-[10px] font-medium uppercase">{day.day}</span>
                <span className="day-number mt-0.5 text-[13px] font-semibold">{day.date}</span>
              </motion.button>
            );
          })}
        </div>

        <CategoryPills
          categories={categories}
          activeId={currentFilters.categoryId}
          onChange={(categoryId) => onFiltersChange?.({ ...currentFilters, categoryId })}
        />

        <div className="current-range-row flex items-center justify-between gap-4 px-1 py-1">
          <div>
            <p className="text-[12px] uppercase tracking-[0.22em] text-on-surface-variant">Current range</p>
            <p className="mt-1 text-sm font-medium text-on-surface">{prettyRange(currentFilters.range)}</p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={onExportCsv}
            className="export-btn ui-btn ui-btn-primary h-11 text-[13px]"
          >
            <Download className="h-4 w-4" />
            {isExportingCsv ? 'Exporting...' : 'Export CSV'}
          </motion.button>
        </div>
      </section>

      <section className="surface-card rounded-[var(--radius-md)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-on-surface">Transactions</p>
            <p className="mt-1 text-sm text-on-surface-variant">{totalCount ?? visibleExpenses.length} results · {prettyCurrency(total, preferenceCurrency)}</p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={onOpenExpenseComposer}
            className="hidden items-center gap-1 text-sm font-medium text-primary sm:inline-flex"
          >
            New expense <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>

        {isLoading ? (
          <div className="mt-4 space-y-3">
            <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-surface-container" />
            <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-surface-container" />
            <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-surface-container" />
          </div>
        ) : groupedExpenses.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="search"
              title="No matching transactions"
              description="Try widening the date range or clearing filters."
              action={{ label: 'Add expense', onClick: onOpenExpenseComposer ?? (() => undefined) }}
            />
          </div>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }} className="mt-4">
            {groupedExpenses.map((group) => {
              const expenseTotal = group.items
                .filter((item) => item.type !== 'income')
                .reduce((sum, item) => sum + getAmountInPreferenceCurrency(item), 0);
              const incomeTotal = group.items
                .filter((item) => item.type === 'income')
                .reduce((sum, item) => sum + getAmountInPreferenceCurrency(item), 0);
              const netTotal = incomeTotal - expenseTotal;
              const progress = (Math.abs(netTotal) / maxDailyTotal) * 100;
              return (
                <div key={group.date} className="mb-6 last:mb-0">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-on-surface-variant">{formatHistoryDateLabel(group.date)}</span>
                        <div className="flex items-center gap-3">
                          <span style={{ color: 'var(--red)' }}>
                            {prettyCurrency(expenseTotal, preferenceCurrency)}
                          </span>
                          <span style={{ color: 'var(--green)' }}>
                            +{prettyCurrency(incomeTotal, preferenceCurrency)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 h-1 rounded-full bg-surface-container">
                        <div
                          className="h-1 rounded-full"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: netTotal >= 0 ? 'var(--green)' : 'var(--red)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    {group.items.map((expense) => (
                      <HistoryRow
                        key={expense.id}
                        expense={expense}
                        deleting={pendingDeleteId === expense.id || deletingExpenseId === expense.id}
                        onDeleteExpense={handleDeleteExpense}
                        onEditExpense={onEditExpense}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </section>
    </PageShell>
  );
}

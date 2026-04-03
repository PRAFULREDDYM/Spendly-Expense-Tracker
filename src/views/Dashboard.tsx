import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  ChartNoAxesCombined,
  ChevronRight,
  Clock3,
  Plus,
  Repeat2,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { Budget, Category, DashboardSummary, Expense, Group, InsightItem, RecurringExpense, Reminder, User, UserPreferences } from '../types';
import {
  EmptyState,
  PageShell,
  UserAvatar,
  prettyCurrency,
  prettyDate,
} from '../components/shell';
import { Sparkline } from '../components/charts/Sparkline';
import { formatCategory } from '../components/ui/categoryIcons';
import {
  buildExpenseTrend,
  clampPercentage,
  formatPeriodDateLabel,
  getCategoryColor,
  getFirstName,
  getMerchantIcon,
  withAlpha,
} from '../lib/ui';

type DashboardPeriod = 'weekly' | 'monthly' | 'yearly';

const periodOptions: Array<{ key: DashboardPeriod; label: string; days: number }> = [
  { key: 'weekly', label: 'Weekly', days: 7 },
  { key: 'monthly', label: 'Monthly', days: 30 },
  { key: 'yearly', label: 'Yearly', days: 365 },
];

function isWithinDays(date: string, days: number) {
  const current = new Date();
  const target = new Date(date);
  const diff = current.getTime() - target.getTime();
  return diff <= days * 24 * 60 * 60 * 1000;
}

function groupMonthly(expenses: Expense[], getAmount: (expense: Expense) => number = (expense) => expense.amount) {
  const now = new Date();
  const buckets = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date),
      amount: 0,
      count: 0,
    };
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const expense of expenses) {
    const date = new Date(expense.expenseDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = bucketMap.get(key);
    if (bucket) {
      bucket.amount += getAmount(expense);
      bucket.count += 1;
    }
  }

  return buckets;
}

function getTrendTone(value: number) {
  if (value > 0) return { bg: 'var(--red-soft)', color: 'var(--red)', icon: '↑' };
  if (value < 0) return { bg: 'var(--green-soft)', color: 'var(--green)', icon: '↓' };
  return { bg: 'var(--bg-elevated)', color: 'var(--text-2)', icon: '—' };
}

function AnimatedValue({
  value,
  formatter,
  className,
  style,
}: {
  value: number;
  formatter: (input: number) => string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const start = display;
    const diff = value - start;
    const startAt = performance.now();
    let frame = 0;

    const tick = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startAt) / 600);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(start + diff * eased);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className} style={style}>{formatter(display)}</span>;
}

function DashboardTransactionRow({
  expense,
}: {
  key?: React.Key;
  expense: Expense;
}) {
  const rawCategoryName = expense.category?.name ?? 'Uncategorized';
  const categoryName = formatCategory(rawCategoryName);
  const merchant = getMerchantIcon(expense.description, rawCategoryName);
  const isIncome = expense.type === 'income';
  const amountTone = isIncome ? 'var(--green)' : 'var(--red)';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="transaction-row group flex min-h-16 items-center gap-3 border-b border-outline/10 py-3 last:border-b-0"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        style={{ backgroundColor: merchant.background, color: merchant.color }}
      >
        {merchant.label}
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
    </motion.div>
  );
}

function GoalRing({
  progress,
  color,
}: {
  progress: number;
  color: string;
}) {
  const radius = 22;
  const circumference = 138.2;
  const dashOffset = circumference - (clampPercentage(progress) / 100) * circumference;

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0 -rotate-90">
      <circle cx="28" cy="28" r={radius} stroke="var(--bg-elevated)" strokeWidth="5" fill="none" />
      <circle
        cx="28"
        cy="28"
        r={radius}
        stroke={color}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
      />
      <text x="28" y="31" textAnchor="middle" fill="var(--text-1)" fontSize="12" fontWeight="700" transform="rotate(90 28 28)">
        {Math.round(progress)}%
      </text>
    </svg>
  );
}

export interface DashboardViewProps {
  user?: User | null;
  preferences?: UserPreferences | null;
  summary?: DashboardSummary;
  recentExpenses?: Expense[];
  budgets?: Budget[];
  categories?: Category[];
  groups?: Group[];
  recurringExpenses?: RecurringExpense[];
  reminders?: Reminder[];
  insights?: InsightItem[];
  isLoading?: boolean;
  headerAccessory?: React.ReactNode;
  onOpenExpenseComposer?: () => void;
  onOpenQuickTransfer?: () => void;
  onNavigateHistory?: () => void;
  onNavigateReports?: () => void;
  onNavigateBudgets?: () => void;
  onOpenGroup?: (groupId: string) => void;
  onAddRecurring?: () => void;
  onLogRecurring?: (recurringId: string) => void;
  onToggleRecurringActive?: (recurringId: string, active: boolean) => void;
  onDeleteRecurring?: (recurringId: string) => void;
  onDismissReminder?: (reminderId: string) => void;
  onLogReminder?: (reminderId: string) => void;
}

export default function DashboardView({
  user,
  preferences,
  summary,
  recentExpenses = [],
  budgets = [],
  categories = [],
  groups = [],
  recurringExpenses = [],
  reminders = [],
  insights = [],
  isLoading = false,
  headerAccessory,
  onOpenExpenseComposer,
  onOpenQuickTransfer,
  onNavigateHistory,
  onNavigateReports,
  onNavigateBudgets,
  onOpenGroup,
  onAddRecurring,
  onLogRecurring,
  onToggleRecurringActive,
  onDeleteRecurring,
  onDismissReminder,
  onLogReminder,
}: DashboardViewProps = {}) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<DashboardPeriod>('monthly');
  const activePeriod = periodOptions.find((item) => item.key === period) ?? periodOptions[1];
  const [summaryMode, setSummaryMode] = useState<'category' | 'net'>('category');
  const preferenceCurrency = preferences?.currency ?? 'USD';

  const selectedTransactions = useMemo(
    () => recentExpenses.filter((expense) => isWithinDays(expense.expenseDate, activePeriod.days)),
    [activePeriod.days, recentExpenses],
  );
  const selectedExpenses = useMemo(
    () => selectedTransactions.filter((expense) => expense.type !== 'income'),
    [selectedTransactions],
  );
  const selectedIncome = useMemo(
    () => selectedTransactions.filter((expense) => expense.type === 'income'),
    [selectedTransactions],
  );

  const previousTransactions = useMemo(
    () => recentExpenses.filter((expense) => {
      const current = new Date();
      const target = new Date(expense.expenseDate);
      const diff = current.getTime() - target.getTime();
      return diff > activePeriod.days * 24 * 60 * 60 * 1000 && diff <= activePeriod.days * 2 * 24 * 60 * 60 * 1000;
    }),
    [activePeriod.days, recentExpenses],
  );
  const previousExpenses = useMemo(
    () => previousTransactions.filter((expense) => expense.type !== 'income'),
    [previousTransactions],
  );

  const getAmountInCurrency = (expense: Expense) => expense.amountInPrimaryCurrency || expense.amount;

  const totalSpent = selectedExpenses.reduce((sum, expense) => sum + getAmountInCurrency(expense), 0);
  const incomeTotal = selectedIncome.reduce((sum, income) => sum + getAmountInCurrency(income), 0);
  const previousTotal = previousExpenses.reduce((sum, expense) => sum + getAmountInCurrency(expense), 0);
  const netBalance = incomeTotal - totalSpent;
  const heroCurrency = preferenceCurrency;
  const heroCaption = null;
  const changePercent = previousTotal > 0 ? ((totalSpent - previousTotal) / previousTotal) * 100 : 0;
  const trendTone = getTrendTone(changePercent);
  const chartExpenses = useMemo(
    () => selectedExpenses.map((expense) => ({ ...expense, amount: getAmountInCurrency(expense) })),
    [selectedExpenses],
  );
  const chartData = period === 'yearly'
    ? groupMonthly(selectedExpenses, (expense) => getAmountInCurrency(expense))
    : buildExpenseTrend(chartExpenses, activePeriod.days);
  const sparklineData = useMemo(
    () => chartData.map((point) => point.amount),
    [chartData],
  );
  const expenseCount = selectedExpenses.length || summary?.recentExpenses.filter((expense) => expense.type !== 'income').length || 0;
  const dailyAverage = expenseCount ? totalSpent / (period === 'yearly' ? 12 : activePeriod.days) : 0;
  const categoryBreakdown = useMemo(() => {
    const grouped = new Map<string, { name: string; total: number; color: string }>();
    for (const expense of selectedExpenses) {
      const name = expense.category?.name ?? 'Uncategorized';
      const color = getCategoryColor(name);
      const current = grouped.get(name);
        const nextAmount = getAmountInCurrency(expense);
      if (current) {
        current.total += nextAmount;
      } else {
        grouped.set(name, { name, total: nextAmount, color });
      }
    }

    return Array.from(grouped.values())
      .sort((left, right) => right.total - left.total)
      .slice(0, 6);
  }, [selectedExpenses]);

  const recurringRows = recurringExpenses.slice(0, 4);
  const monthlyRecurringOutflow = recurringExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const annualRecurringAmount = monthlyRecurringOutflow * 12;

  const currentLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
  const dashboardTitle = `Hello, ${getFirstName(user?.name)} 👋`;
  const reminderMap = useMemo(() => new Map(recurringExpenses.map((item) => [item.id, item])), [recurringExpenses]);
  const reminderBanner = reminders[0] ? { reminder: reminders[0], recurring: reminderMap.get(reminders[0].recurringExpenseId) ?? null } : null;

  return (
    <PageShell className="pt-6">
      <div className="w-full max-w-full min-w-0 space-y-6 overflow-hidden">
        {reminderBanner?.recurring ? (
          <section
            className="rounded-[var(--radius-md)] border border-outline/10 px-4 py-3 shadow-[var(--shadow-sm)]"
            style={{
              backgroundColor: new Date(`${reminderBanner.reminder.dueDate}T00:00:00`) < new Date() ? 'var(--red-soft)' : 'var(--amber-soft)',
              borderLeft: `3px solid ${new Date(`${reminderBanner.reminder.dueDate}T00:00:00`) < new Date() ? 'var(--red)' : 'var(--amber)'}`,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: new Date(`${reminderBanner.reminder.dueDate}T00:00:00`) < new Date() ? 'var(--red)' : 'var(--amber)' }} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-on-surface">
                    {reminderBanner.recurring.name} {new Date(`${reminderBanner.reminder.dueDate}T00:00:00`) < new Date() ? 'is overdue' : 'is due soon'}
                  </p>
                  <p className="mt-1 text-[13px] text-on-surface-variant">
                    {prettyCurrency(reminderBanner.recurring.amount, reminderBanner.recurring.currency)} · due {prettyDate(reminderBanner.reminder.dueDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onLogReminder?.(reminderBanner.reminder.id)} className="rounded-full px-3 py-2 text-[13px] font-semibold text-on-surface">
                  Log it
                </button>
                <button type="button" onClick={() => onDismissReminder?.(reminderBanner.reminder.id)} className="rounded-full px-3 py-2 text-[13px] font-semibold text-on-surface-variant">
                  ×
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <header className="flex items-center justify-between gap-3 md:hidden">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex min-w-0 items-center gap-3 text-left"
            aria-label="Open profile"
          >
            <UserAvatar user={user} className="h-10 w-10 shrink-0 text-[11px]" textClassName="text-[11px]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-on-surface">{dashboardTitle}</p>
              <p className="truncate text-[12px] text-on-surface-variant">{currentLabel}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="ui-icon-btn h-10 w-10 shrink-0"
            aria-label="Open history"
          >
            <Bell className="h-4 w-4 text-on-surface-variant" />
          </button>
        </header>

        <header className="hidden items-center justify-between gap-4 md:flex">
          <div className="min-w-0 space-y-1">
            <h1 className="page-title truncate text-[28px] font-bold tracking-[-0.03em] text-on-surface">{dashboardTitle}</h1>
            <p className="page-subtitle text-sm leading-6 text-on-surface-variant">{currentLabel}</p>
          </div>
          {headerAccessory ? <div className="flex items-center gap-2">{headerAccessory}</div> : null}
        </header>

        <div className="filter-pills-row horizontal-scroll flex items-center gap-1 overflow-x-auto hide-scrollbar">
          {periodOptions.map((option) => {
            const active = option.key === period;
            return (
              <motion.button
                key={option.key}
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => setPeriod(option.key)}
                className="pill-filter"
                style={{
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-2)',
                }}
              >
                {option.label}
              </motion.button>
            );
          })}
        </div>

        {insights.length > 0 ? (
          <section className="horizontal-scroll flex gap-3 overflow-x-auto hide-scrollbar">
            {insights.map((insight) => {
              const colorMap = {
                accent: 'var(--accent)',
                green: 'var(--green)',
                amber: 'var(--amber)',
                red: 'var(--red)',
              } as const;
              const tone = colorMap[insight.color];
              return (
                <article
                  key={insight.id}
                  className="min-w-[260px] flex-1 rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4 shadow-[var(--shadow-sm)]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: tone }}>
                    {insight.type.replaceAll('_', ' ')}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{insight.title}</p>
                  <p className="mt-1 text-[13px] leading-6 text-on-surface-variant">{insight.detail}</p>
                  {insight.actionLabel ? (
                    <button type="button" className="mt-3 rounded-full bg-primary/10 px-3 py-2 text-[13px] font-semibold text-primary">
                      {insight.actionLabel}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </section>
        ) : null}

        <motion.section layout className="w-full max-w-full space-y-4 overflow-x-hidden">
          <motion.div
            layout
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="hero-card relative overflow-hidden rounded-[24px] border border-white/10 p-6"
            style={{
              minHeight: 236,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'var(--hero-glow)' }}
            />
            <div className="hero-card-inner relative z-10 flex h-full flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--hero-icon-bg)' }}>
                  <Wallet className="h-5 w-5" style={{ color: 'var(--hero-text)' }} />
                </div>
                <p className="text-[13px]" style={{ color: 'var(--hero-text-muted)' }}>{user?.name ?? 'Account holder'}</p>
              </div>

              <div className="pt-5">
                <p className="hero-label text-[11px] font-medium uppercase tracking-[0.28em]" style={{ color: 'var(--hero-text-soft)' }}>Total spent</p>
                <AnimatedValue
                  value={totalSpent}
                  formatter={(next) => prettyCurrency(next, heroCurrency)}
                  className="hero-amount mt-3 block text-[36px] font-bold tracking-[-0.03em]"
                  style={{ color: 'var(--hero-text)' }}
                />
                {heroCaption ? <p className="mt-2 text-[11px]" style={{ color: 'var(--hero-text-soft)' }}>{heroCaption}</p> : null}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--hero-text-soft)' }}>Income</p>
                    <p className="hero-secondary-amount text-[15px] font-semibold text-[var(--green)]">{prettyCurrency(incomeTotal, preferenceCurrency)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--hero-text-soft)' }}>Savings</p>
                    <p
                      className="hero-secondary-amount text-[15px] font-semibold"
                      style={{
                        color: netBalance > 0 ? 'var(--green)' : netBalance < 0 ? 'var(--red)' : 'var(--text-2)',
                      }}
                    >
                      {netBalance === 0 ? '—' : `${netBalance > 0 ? '+' : ''}${prettyCurrency(netBalance, preferenceCurrency)}`}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="h-20">
                  <Sparkline data={sparklineData} color="var(--hero-text-muted)" showEndDot={false} />
                </div>
                <div className="my-3 border-t" style={{ borderTopColor: 'var(--hero-line)' }} />
                <div className="flex items-center justify-between pt-0">
                  <div>
                    <p className="text-[11px]" style={{ color: 'var(--hero-text-muted)' }}>{periodOptions.find((option) => option.key === period)?.label}</p>
                    <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--hero-text)' }}>{expenseCount} expenses</p>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 rounded-[6px] px-[10px] py-1 text-[12px] font-semibold" style={{ backgroundColor: trendTone.bg, color: trendTone.color }}>
                      <span>{trendTone.icon}</span>
                      <span>{Math.abs(changePercent).toFixed(1)}%</span>
                    </div>
                    <p className="mt-2 text-[11px]" style={{ color: 'var(--hero-text-muted)' }}>Daily avg</p>
                    <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--hero-text)' }}>{prettyCurrency(dailyAverage, preferenceCurrency)}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="action-row action-buttons-row grid grid-cols-4 gap-3">
            {[
              { label: 'Add', icon: <Plus className="h-5 w-5" />, onClick: onOpenExpenseComposer },
              { label: 'Report', icon: <ChartNoAxesCombined className="h-5 w-5" />, onClick: onNavigateReports },
              { label: 'Budget', icon: <Wallet className="h-5 w-5" />, onClick: onNavigateBudgets },
              { label: 'Transfer', icon: <ArrowIcon />, onClick: onOpenQuickTransfer },
            ].map((action) => (
              <motion.button
                whileTap={{ scale: 0.96 }}
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="action-button flex flex-col items-center gap-2"
              >
                <div className="action-btn-circle action-button-circle flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-primary">
                  {action.icon}
                </div>
                <span className="action-btn-label action-button-label text-[10px] font-medium text-on-surface-variant">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.section>

        <div className="dashboard-grid grid w-full max-w-full gap-4 overflow-x-hidden lg:grid-cols-3" style={{ minWidth: 0 }}>
          <section className="surface-card rounded-[var(--radius-md)] p-4 lg:col-span-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">Top categories</p>
              <button type="button" onClick={onNavigateReports} className="text-[13px] font-medium text-primary">
                See all <ChevronRight className="inline h-3.5 w-3.5" />
              </button>
            </div>
            {categoryBreakdown.length === 0 ? (
              <div className="mt-4 flex items-center gap-2 rounded-full border border-dashed border-outline/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-outline/40" />
                <p className="min-w-0">Add your first categorized expense to see top categories here.</p>
              </div>
            ) : (
              <div className="top-categories-scroll horizontal-scroll mt-4 flex gap-2 overflow-x-auto hide-scrollbar">
                {categoryBreakdown.map((category) => (
                  <motion.button
                    key={category.name}
                    whileTap={{ scale: 0.96 }}
                    className="category-pill flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm"
                    style={{
                      background: withAlpha(category.color, 0.15),
                      borderColor: withAlpha(category.color, 0.25),
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="font-medium text-on-surface">{formatCategory(category.name)}</span>
                    <span className="font-semibold" style={{ color: category.color }}>{prettyCurrency(category.total, preferenceCurrency)}</span>
                  </motion.button>
                ))}
              </div>
            )}
          </section>

          <section className="stat-cards-grid grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:col-span-3" style={{ minWidth: 0, maxWidth: '100%' }}>
              {[
                { label: 'Expenses', value: prettyCurrency(totalSpent, preferenceCurrency), tone: 'var(--accent)', soft: 'var(--accent-soft)', icon: <Wallet className="h-4 w-4" />, valueColor: 'var(--text-1)', subtext: undefined },
                { label: 'Income', value: prettyCurrency(incomeTotal, preferenceCurrency), tone: 'var(--green)', soft: 'var(--green-soft)', icon: <TrendingUp className="h-4 w-4" />, valueColor: 'var(--green)', subtext: undefined },
                {
                  label: 'Savings',
                  value: netBalance === 0 ? '—' : `${netBalance > 0 ? '+' : ''}${prettyCurrency(netBalance, preferenceCurrency)}`,
                  tone: netBalance >= 0 ? 'var(--green)' : 'var(--red)',
                  soft: netBalance >= 0 ? 'var(--green-soft)' : 'var(--red-soft)',
                  icon: <PiggyBank className="h-4 w-4" />,
                  valueColor: netBalance > 0 ? 'var(--green)' : netBalance < 0 ? 'var(--red)' : 'var(--text-1)',
                  subtext: incomeTotal > 0 && totalSpent > 0 ? `${Math.round((netBalance / incomeTotal) * 100)}% of income` : undefined,
                },
                {
                  label: 'Budget usage',
                  value: `${summary?.budgetUsagePercent?.toFixed(0) ?? '0'}%`,
                  tone: (summary?.budgetUsagePercent ?? 0) > 80 ? 'var(--red)' : 'var(--amber)',
                  soft: (summary?.budgetUsagePercent ?? 0) > 80 ? 'var(--red-soft)' : 'var(--amber-soft)',
                  icon: <AlertTriangle className="h-4 w-4" />,
                  valueColor: (summary?.budgetUsagePercent ?? 0) > 80 ? 'var(--red)' : 'var(--text-1)',
                  subtext: undefined,
                },
              ].map((item) => (
              <motion.div
                key={item.label}
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="stat-card surface-card min-w-0 rounded-[var(--radius-md)] border border-[var(--border-md)] p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="stat-card-label whitespace-nowrap text-[11px] uppercase tracking-[0.18em] text-on-surface-variant sm:text-[12px] sm:tracking-[0.22em]">{item.label}</p>
                    <p className="stat-card-value mt-3 whitespace-nowrap break-keep text-[22px] font-bold leading-tight tracking-[-0.03em] sm:mt-4 sm:text-[28px]" style={{ color: item.valueColor }}>{item.value}</p>
                    {item.subtext ? <p className="mt-2 text-xs text-on-surface-variant">{item.subtext}</p> : null}
                  </div>
                  <div className="stat-card-icon-circle flex h-8 w-8 shrink-0 self-start items-center justify-center rounded-full" style={{ backgroundColor: item.soft, color: item.tone }}>
                    {item.icon}
                  </div>
                </div>
              </motion.div>
            ))}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="summary-card stat-card col-span-2 surface-card min-w-0 rounded-[var(--radius-md)] border border-[var(--border-md)] p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.22em] text-on-surface-variant">
                    {summaryMode === 'category' ? 'Top category' : 'Savings'}
                  </p>
                  <p
                    className="mt-4 text-[28px] font-bold tracking-[-0.03em]"
                    style={{
                      color: summaryMode === 'net'
                        ? netBalance > 0 ? 'var(--green)' : netBalance < 0 ? 'var(--red)' : 'var(--text-1)'
                        : 'var(--text-1)',
                    }}
                  >
                    {summaryMode === 'category'
                      ? summary?.topCategory?.name ? formatCategory(summary.topCategory.name) : categoryBreakdown[0]?.name ? formatCategory(categoryBreakdown[0].name) : '--'
                      : netBalance === 0 ? '—' : `${netBalance > 0 ? '+' : ''}${prettyCurrency(netBalance, preferenceCurrency)}`}
                  </p>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {summaryMode === 'category' ? 'Highest spending category this period' : 'Income - Expenses this period'}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-[6px] bg-surface-container p-1">
                    {[
                      { key: 'category', label: 'Category' },
                      { key: 'net', label: 'Savings' },
                    ].map((option) => {
                      const active = option.key === summaryMode;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setSummaryMode(option.key as 'category' | 'net')}
                          className="rounded-[4px] px-2 py-1 text-[10px] font-medium"
                          style={{
                            backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                            color: active ? 'var(--accent)' : 'var(--text-3)',
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: summaryMode === 'net'
                        ? netBalance >= 0 ? 'var(--green-soft)' : 'var(--red-soft)'
                        : 'var(--green-soft)',
                      color: summaryMode === 'net'
                        ? netBalance >= 0 ? 'var(--green)' : 'var(--red)'
                        : 'var(--green)',
                    }}
                  >
                    {summaryMode === 'net'
                      ? netBalance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />
                      : <TrendingUp className="h-4 w-4" />}
                  </div>
                </div>
              </div>
            </motion.div>
	          </section>

	          <section className="recent-section surface-card rounded-[var(--radius-md)] p-4 lg:col-span-2">
	            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-on-surface">Recent</p>
              <button type="button" onClick={onNavigateHistory} className="text-[13px] font-medium text-primary">
                View all <ChevronRight className="inline h-3.5 w-3.5" />
              </button>
            </div>
            {isLoading ? (
              <div className="mt-4 space-y-3">
                <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-surface-container" />
                <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-surface-container" />
                <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-surface-container" />
              </div>
            ) : recentExpenses.length === 0 ? (
              <div className="mt-4 recurring-empty-state">
                <EmptyState
                  icon="history"
                  title="No transactions yet"
                  description="Add your first expense to bring the dashboard to life."
                  action={{ label: 'Add expense', onClick: onOpenExpenseComposer ?? (() => undefined) }}
                />
              </div>
	            ) : (
	              <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }} className="mt-2">
	                {recentExpenses.slice(0, 6).map((expense) => (
	                  <DashboardTransactionRow
	                    key={expense.id}
	                    expense={expense}
	                  />
	                ))}
	              </motion.div>
	            )}
          </section>

          {budgets.length > 0 && (
            <section className="surface-card rounded-[var(--radius-md)] p-4 lg:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-on-surface">Goals</p>
                <button type="button" onClick={onNavigateBudgets} className="text-[13px] font-medium text-primary">
                  See all <ChevronRight className="inline h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {budgets.slice(0, 4).map((budget) => {
                  const category = categories?.find((item) => item.id === budget.categoryId);
                  const rawName = category?.name ?? 'Overall goal';
                  const name = category ? formatCategory(category.name) : rawName;
                  const color = getCategoryColor(rawName);
                  const progress = Math.min(100, (budget.spent / Math.max(budget.amount, 1)) * 100);
                  const tone = progress >= 80 ? 'var(--green)' : progress >= 50 ? 'var(--amber)' : 'var(--red)';
                  return (
                    <motion.div
                      key={budget.id}
                      whileHover={{ y: -2 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                      className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <GoalRing progress={progress} color={color} />
                          <div>
                            <p className="text-sm font-medium text-on-surface">{name}</p>
                            <p className="mt-1 text-xs text-on-surface-variant">of {prettyCurrency(budget.amount, budget.currency)}</p>
                          </div>
                        </div>
                        <p className="text-[20px] font-bold tracking-[-0.03em]" style={{ color: tone }}>
                          {progress.toFixed(0)}%
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={onNavigateBudgets}
                  className="flex min-h-[116px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-outline/25 bg-surface-container-low text-sm font-semibold text-primary"
                >
                  Add goal
                </motion.button>
              </div>
            </section>
          )}

          <section className="recurring-section surface-card min-w-0 rounded-[var(--radius-md)] p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <p className="min-w-0 text-base font-semibold text-on-surface">Recurring expenses</p>
              <Repeat2 className="h-4 w-4 text-on-surface-variant" />
            </div>
            <div className="recurring-stat-pills horizontal-scroll mt-4 flex gap-2 overflow-x-auto hide-scrollbar">
              <div className="recurring-stat-pill min-w-0 whitespace-nowrap rounded-full bg-[var(--red-soft)] px-3 py-2 text-sm font-semibold text-[var(--red)]">
                Monthly outflow {prettyCurrency(monthlyRecurringOutflow, preferenceCurrency)}
              </div>
              <div className="recurring-stat-pill min-w-0 whitespace-nowrap rounded-full bg-surface-container px-3 py-2 text-sm font-semibold text-on-surface">
                Annual amount {prettyCurrency(annualRecurringAmount, preferenceCurrency)}
              </div>
            </div>
            {recurringRows.length === 0 ? (
              <div className="mt-4 recurring-empty-state min-w-0 rounded-[var(--radius-md)] border border-dashed border-outline/20 bg-surface-container-low p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-on-surface">No recurring expenses yet</p>
                    <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                      Mark a transaction as recurring and it will show up here with its next cycle.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onAddRecurring ?? onOpenExpenseComposer ?? (() => undefined)}
                    className="ui-btn ui-btn-primary h-11 w-full shrink-0 whitespace-nowrap sm:w-auto"
                  >
                    Add recurring expense
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {recurringRows.map((expense) => {
                  const rawCategoryName = categories.find((category) => category.id === expense.categoryId)?.name ?? 'Recurring';
                  const categoryName = formatCategory(rawCategoryName);
                  const merchant = getMerchantIcon(expense.name, rawCategoryName);
                  const dueDate = new Date(`${expense.nextDue}T00:00:00`);
                  const daysUntilDue = Math.round((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  const tone = daysUntilDue < 0 ? 'var(--red)' : daysUntilDue <= 3 ? 'var(--amber)' : 'var(--green)';
                  return (
                    <motion.article
                      key={expense.id}
                      whileHover={{ y: -2 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                      className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                            style={{ backgroundColor: merchant.background, color: merchant.color }}
                          >
                            {merchant.label}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-on-surface">{expense.name}</p>
                            <p className="mt-1 min-w-0 text-xs leading-5 text-on-surface-variant">
                              {categoryName} · {expense.frequency} · {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : daysUntilDue === 0 ? 'Due today' : `Due in ${daysUntilDue} days`}
                            </p>
                          </div>
	                        </div>
	                        <div className="text-right">
	                          <p className="whitespace-nowrap text-sm font-semibold" style={{ color: tone }}>{prettyCurrency(expense.amount, expense.currency)}</p>
	                          <div className="mt-2 flex justify-end gap-2">
	                            <button type="button" onClick={() => onLogRecurring?.(expense.id)} className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">Log</button>
	                            <button type="button" onClick={() => onToggleRecurringActive?.(expense.id, expense.active)} className="rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">{expense.active ? 'Pause' : 'Resume'}</button>
	                            <button type="button" onClick={() => onDeleteRecurring?.(expense.id)} className="rounded-full bg-[var(--red-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--red)]">Delete</button>
	                          </div>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </section>

          {groups.length > 0 ? (
            <section className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4 shadow-[var(--shadow-sm)] lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">Shared budgets</p>
                  <p className="mt-1 text-[13px] text-on-surface-variant">See how your family and shared plans are tracking.</p>
                </div>
                <UsersRound className="h-5 w-5 text-on-surface-variant" />
              </div>
              <div className="mt-4 grid gap-3">
                {groups.map((group) => {
                  const totalBudget = (group.budgets ?? []).reduce((sum, budget) => sum + budget.amount, 0);
                  const totalSpent = (group.budgets ?? []).reduce((sum, budget) => sum + budget.spent, 0);
                  const progress = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => onOpenGroup?.(group.id)}
                      className="rounded-[var(--radius-sm)] bg-[var(--bg-card)] px-4 py-4 text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-on-surface">{group.name}</p>
                          <p className="mt-1 text-[13px] text-on-surface-variant">{prettyCurrency(totalSpent, preferenceCurrency)} of {prettyCurrency(totalBudget, preferenceCurrency)} spent</p>
                        </div>
                        <div className="flex -space-x-2">
                          {group.members.slice(0, 3).map((member) => (
                            <UserAvatar
                              key={member.id}
                              user={{ name: member.name ?? member.email ?? 'Member', email: member.email ?? '', avatarUrl: member.avatarUrl ?? null }}
                              className="h-8 w-8 border-2 border-[var(--bg-card)] text-[10px]"
                              textClassName="text-[10px]"
                            />
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-[var(--bg-elevated)]">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>

    </PageShell>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7h10v10" />
      <path d="m7 17 10-10" />
    </svg>
  );
}

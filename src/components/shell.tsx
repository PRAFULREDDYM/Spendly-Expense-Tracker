import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CalendarDays,
  ChartColumn,
  CheckCircle2,
  Download,
  House,
  Inbox,
  Info,
  PieChart,
  Plus,
  ReceiptText,
  Search,
  Target,
  TriangleAlert,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import type { Category, CurrencyCode, DashboardSummary, DateRange, Expense, User, UserPreferences } from '../types';
import { getCategoryColor, withAlpha } from '../lib/ui';
import { formatCategory, getCategoryIcon } from './ui/categoryIcons';

export type ScreenKey = 'splash' | 'signin' | 'signup' | 'dashboard' | 'history' | 'analysis' | 'profile';
export type ReportPreset = 'thisWeek' | 'thisMonth' | 'custom';
export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface DateRangeValue extends DateRange {
  preset: ReportPreset;
}

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
  durationMs: number;
}

export interface NavigationItem {
  key: ScreenKey;
  label: string;
  icon: string;
}

export interface ShellAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: string;
  disabled?: boolean;
}

export interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  elevated?: boolean;
}

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ShellAction;
  icon?: string;
}

export interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  tone?: 'default' | 'positive' | 'negative' | 'accent';
  icon?: string;
}

export interface PageShellProps {
  title?: string;
  subtitle?: string;
  action?: ShellAction;
  headerAccessory?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export interface TabRailProps {
  current: ScreenKey;
  items: NavigationItem[];
  onNavigate: (screen: ScreenKey) => void;
  onPrimaryAction: () => void;
  onPrimaryActionLongPress?: () => void;
}

export interface ToastViewportProps {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}

export interface DateRangePickerProps {
  label?: string;
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  className?: string;
}

export interface SummaryStripProps {
  summary?: DashboardSummary;
  isLoading?: boolean;
}

export interface RecentExpenseItemProps {
  key?: React.Key;
  expense: Expense;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function hashValue(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 360;
  }
  return hash;
}

export function getUserInitials(user?: Pick<User, 'name' | 'email'> | null) {
  const seed = user?.name?.trim() || user?.email?.trim() || '';
  if (!seed) {
    return '?';
  }

  const parts = seed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }

  return seed.slice(0, 2).toUpperCase();
}

function getAvatarBackground(user?: Pick<User, 'name' | 'email'> | null) {
  const hue = hashValue(`${user?.name ?? ''}:${user?.email ?? ''}`);
  const nextHue = (hue + 42) % 360;
  return `linear-gradient(135deg, hsl(${hue} 62% 56%), hsl(${nextHue} 72% 42%))`;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value: string) {
  if (!value) return 'Select date';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function formatDisplayMonth(value: string) {
  if (!value) return 'Select month';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T00:00:00`));
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function buildDefaultRange(reference = new Date()): DateRangeValue {
  const end = reference;
  const start = addDays(reference, -6);
  return {
    preset: 'thisWeek',
    start: formatDateInput(start),
    end: formatDateInput(end),
  };
}

export function monthRange(reference = new Date()): DateRangeValue {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return {
    preset: 'thisMonth',
    start: formatDateInput(start),
    end: formatDateInput(end),
  };
}

export function prettyCurrency(value: number | undefined, currency: CurrencyCode = 'USD') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function prettyDate(date: string, options: Intl.DateTimeFormatOptions = {}) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...options }).format(new Date(date));
}

export function prettyRange(range: Pick<DateRangeValue, 'start' | 'end'>) {
  const startValue = range.start.length > 10 ? range.start.slice(0, 10) : range.start;
  const endValue = range.end.length > 10 ? range.end.slice(0, 10) : range.end;
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)} - ${new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(end)}`;
  }

  return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)} - ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(end)}`;
}

export function UserAvatar({
  user,
  avatarUrl,
  className,
  textClassName,
}: {
  user?: Pick<User, 'name' | 'email' | 'avatarUrl'> | null;
  avatarUrl?: string | null;
  className?: string;
  textClassName?: string;
}) {
  const imageUrl = avatarUrl ?? user?.avatarUrl ?? null;
  const fallbackBackground = useMemo(() => getAvatarBackground(user), [user?.email, user?.name]);

  return (
    <div
      className={cn('flex items-center justify-center overflow-hidden rounded-full text-white', className)}
      style={imageUrl ? undefined : { backgroundImage: fallbackBackground }}
      aria-hidden="true"
    >
      {imageUrl ? (
        <img src={imageUrl} alt={user?.name ? `${user.name} profile` : 'Profile'} className="h-full w-full object-cover" />
      ) : (
        <span className={cn('font-semibold tracking-[0.08em]', textClassName)}>{getUserInitials(user)}</span>
      )}
    </div>
  );
}

export function PageShell({ title, subtitle, action, headerAccessory, children, className }: PageShellProps) {
  return (
    <motion.main
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'page-wrapper page-content main-content relative isolate w-full max-w-full px-4 pt-5 pb-8 md:px-8 md:pt-8 md:pb-12',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-full flex-col gap-6 md:max-w-7xl">
        {(title || subtitle || action || headerAccessory) && (
          <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              {title && <h1 className="page-title text-[28px] font-bold tracking-[-0.03em] text-on-surface">{title}</h1>}
              {subtitle && <p className="page-subtitle max-w-2xl text-sm leading-6 text-on-surface-variant">{subtitle}</p>}
            </div>
            {(action || headerAccessory) && (
              <div className="header-actions flex flex-wrap items-center justify-end gap-3">
        {action && (
          <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={cn(
                      'ui-btn h-11',
                      action.variant === 'secondary' && 'ui-btn-secondary',
                      action.variant === 'ghost' && 'ui-btn-ghost',
                      (!action.variant || action.variant === 'primary') && 'ui-btn-primary',
                      action.disabled && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    {action.icon && <span className="text-sm">{action.icon}</span>}
                    {action.label}
                  </motion.button>
                )}
                {headerAccessory}
              </div>
            )}
          </header>
        )}
        {children}
      </div>
    </motion.main>
  );
}

export function SectionCard({ className, elevated = false, ...props }: SectionCardProps) {
  return (
    <section
      className={cn(
        'surface-card rounded-[var(--radius-md)] p-5 sm:p-6',
        elevated && 'shadow-[var(--shadow)]',
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ShellAction }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        {eyebrow && <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-outline">{eyebrow}</p>}
        <h2 className="text-lg font-semibold tracking-tight text-on-surface sm:text-xl">{title}</h2>
      </div>
      {action && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={action.onClick}
          disabled={action.disabled}
          className={cn(
            'ui-btn h-10 rounded-[var(--radius-pill)] px-4',
            action.variant === 'secondary' && 'ui-btn-secondary',
            action.variant === 'ghost' && 'ui-btn-ghost',
            (!action.variant || action.variant === 'primary') && 'ui-btn-primary',
          )}
        >
          {action.icon && <span className="text-sm">{action.icon}</span>}
          {action.label}
        </motion.button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action, icon = 'inbox' }: EmptyStateProps) {
  const iconMap: Record<string, { node: React.ReactNode; background: string; color: string }> = {
    inbox: { node: <Inbox className="h-5 w-5" />, background: 'var(--accent-soft)', color: 'var(--accent)' },
    search: { node: <Search className="h-5 w-5" />, background: 'var(--accent-soft)', color: 'var(--accent)' },
    analytics: { node: <ChartColumn className="h-5 w-5" />, background: 'var(--accent-soft)', color: 'var(--accent)' },
    history: { node: <ReceiptText className="h-5 w-5" />, background: 'var(--accent-soft)', color: 'var(--accent)' },
    wallet: { node: <Wallet className="h-5 w-5" />, background: 'var(--amber-soft)', color: 'var(--amber)' },
    category: { node: <PieChart className="h-5 w-5" />, background: 'var(--purple-soft)', color: 'var(--accent)' },
    target: { node: <Target className="h-5 w-5" />, background: 'var(--amber-soft)', color: 'var(--amber)' },
  };
  const activeIcon = iconMap[icon] ?? iconMap.inbox;

  return (
    <SectionCard className="empty-state-card flex w-full min-h-[180px] flex-col items-center justify-center gap-5 text-center sm:min-h-[220px]">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: activeIcon.background, color: activeIcon.color }}
      >
        {activeIcon.node}
      </div>
      <div className="empty-state-text max-w-md space-y-2">
        <h3 className="text-base font-semibold tracking-tight text-on-surface">{title}</h3>
        <p className="text-[13px] leading-6 text-on-surface-variant">{description}</p>
      </div>
      {action && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={action.onClick}
          className={cn(
            'empty-state-action ui-btn h-11 px-5',
            action.variant === 'secondary' && 'ui-btn-secondary',
            action.variant === 'ghost' && 'ui-btn-ghost',
            (!action.variant || action.variant === 'primary') && 'ui-btn-primary',
          )}
        >
          {action.icon && <span className="text-sm">{action.icon}</span>}
          {action.label}
        </motion.button>
      )}
    </SectionCard>
  );
}

export function InlineNotice({ tone = 'info', title, message }: { tone?: ToastTone; title: string; message?: string }) {
  const palette = {
    info: 'border-secondary/20 bg-secondary/5 text-secondary',
    success: 'border-tertiary/20 bg-tertiary/5 text-tertiary',
    warning: 'border-yellow-500/20 bg-yellow-50 text-yellow-700',
    error: 'border-error/20 bg-error/5 text-error',
  }[tone];

  return (
    <div className={cn('rounded-2xl border px-4 py-3', palette)}>
      <p className="text-sm font-semibold">{title}</p>
      {message && <p className="mt-1 text-sm/6 opacity-80">{message}</p>}
    </div>
  );
}

export function MetricCard({ label, value, delta, tone = 'default', icon }: MetricCardProps) {
  const toneClasses = {
    default: 'bg-surface-container-low text-on-surface',
    positive: 'bg-tertiary/5 text-tertiary',
    negative: 'bg-error/5 text-error',
    accent: 'bg-primary/5 text-primary',
  }[tone];
  const iconNode = icon === 'payments'
    ? <Wallet className="h-5 w-5" aria-hidden="true" />
    : icon === 'schedule'
      ? <CalendarDays className="h-5 w-5" aria-hidden="true" />
      : icon === 'category'
        ? <PieChart className="h-5 w-5" aria-hidden="true" />
        : icon === 'donut_small'
          ? <Target className="h-5 w-5" aria-hidden="true" />
          : icon === 'history'
            ? <ReceiptText className="h-5 w-5" aria-hidden="true" />
            : icon === 'search'
              ? <Search className="h-5 w-5" aria-hidden="true" />
              : <Inbox className="h-5 w-5" aria-hidden="true" />;

  return (
    <div className={cn('rounded-[1.5rem] border border-outline/10 p-4 shadow-[0_16px_60px_rgba(15,23,42,0.05)]', toneClasses)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] opacity-75">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {delta && <p className="text-sm opacity-75">{delta}</p>}
        </div>
        {icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-container-low/80 text-current shadow-sm">
            {iconNode}
          </div>
        )}
      </div>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-gradient-to-r from-surface-container-low via-surface-container to-surface-container-low bg-[length:200%_100%]', className)} />;
}

export function SummaryStrip({ summary, isLoading }: SummaryStripProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
      </div>
    );
  }

  const topCategory = summary?.topCategory?.name ?? 'No category yet';
  const trend = typeof summary?.trendPercent === 'number' ? `${summary.trendPercent > 0 ? '+' : ''}${summary.trendPercent.toFixed(1)}% vs last month` : 'Waiting for live spend data';

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="This month" value={prettyCurrency(summary?.totalThisMonth)} delta={trend} tone="accent" icon="payments" />
      <MetricCard label="Daily average" value={prettyCurrency(summary?.dailyAverage)} delta="Calculated from the selected range" tone="default" icon="schedule" />
      <MetricCard label="Top category" value={topCategory} delta={summary?.topCategory ? prettyCurrency(summary.topCategorySpend) : 'No spend recorded yet'} tone="positive" icon="category" />
      <MetricCard label="Budget usage" value={summary ? `${summary.budgetUsagePercent.toFixed(0)}%` : '—'} delta={summary ? 'Across your active budgets' : 'Add budgets to track progress'} tone="negative" icon="donut_small" />
    </div>
  );
}

export function DateRangePicker({ label = 'Report range', value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const labelText = useMemo(() => prettyRange(value), [value]);

  return (
    <div className={cn('relative z-[70]', className)}>
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className="inline-flex h-11 w-full items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-outline/10 bg-surface-container-low px-4 text-left transition-colors hover:bg-surface-container"
      >
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-outline">{label}</p>
          <p className="text-sm font-semibold text-on-surface">{labelText}</p>
        </div>
        <CalendarDays size={16} className="text-outline" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.75rem)] z-[80] w-[min(24rem,calc(100vw-2rem))] rounded-[var(--radius-md)] border border-outline/10 bg-surface-container p-4 shadow-[var(--shadow)] sm:left-auto sm:right-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-on-surface">Choose range</p>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-outline transition-colors hover:bg-surface-container-low">
              <X size={16} />
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {([
              { key: 'thisWeek', label: 'This week', range: buildDefaultRange() },
              { key: 'thisMonth', label: 'This month', range: monthRange() },
              { key: 'custom', label: 'Custom range', range: value },
            ] as const).map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => onChange({ ...preset.range, preset: preset.key })}
                className={cn(
                  'rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors',
                  value.preset === preset.key ? 'border-primary bg-primary/5 text-primary' : 'border-outline/10 hover:bg-surface-container-low',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label htmlFor={`${id}-start`} className="space-y-1 text-sm">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">Start date</span>
              <div className="picker-shell">
                <CalendarDays size={16} className="text-outline" />
                <span className="text-sm font-medium text-on-surface">{formatDisplayDate(value.start)}</span>
                <input
                  id={`${id}-start`}
                  type="date"
                  value={value.start}
                  onChange={(event) => onChange({ ...value, preset: 'custom', start: event.target.value })}
                  className="picker-native"
                />
              </div>
            </label>
            <label htmlFor={`${id}-end`} className="space-y-1 text-sm">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-outline">End date</span>
              <div className="picker-shell">
                <CalendarDays size={16} className="text-outline" />
                <span className="text-sm font-medium text-on-surface">{formatDisplayDate(value.end)}</span>
                <input
                  id={`${id}-end`}
                  type="date"
                  value={value.end}
                  onChange={(event) => onChange({ ...value, preset: 'custom', end: event.target.value })}
                  className="picker-native"
                />
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export function StyledDateField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={cn('picker-shell', className)}>
      <CalendarDays className="h-4 w-4 text-on-surface-variant" />
      <span className="truncate text-sm font-medium text-on-surface">{formatDisplayDate(value)}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="picker-native" />
    </label>
  );
}

export function StyledMonthField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={cn('picker-shell', className)}>
      <CalendarDays className="h-4 w-4 text-on-surface-variant" />
      <span className="truncate text-sm font-medium text-on-surface">{formatDisplayMonth(value)}</span>
      <input type="month" value={value} onChange={(event) => onChange(event.target.value)} className="picker-native" />
    </label>
  );
}

export function TabRail({ current, items, onNavigate, onPrimaryAction, onPrimaryActionLongPress }: TabRailProps) {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearPrimaryActionTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePrimaryActionPressStart = () => {
    clearPrimaryActionTimer();
    longPressTriggeredRef.current = false;

    if (!onPrimaryActionLongPress) {
      return;
    }

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onPrimaryActionLongPress();
    }, 500);
  };

  const handlePrimaryActionPressEnd = () => {
    const triggered = longPressTriggeredRef.current;
    clearPrimaryActionTimer();
    longPressTriggeredRef.current = false;

    if (!triggered) {
      onPrimaryAction();
    }
  };

  const handlePrimaryActionPressCancel = () => {
    clearPrimaryActionTimer();
    longPressTriggeredRef.current = false;
  };

  const handlePrimaryActionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onPrimaryAction();
  };

  const renderNavigationIcon = (icon: string, active: boolean) => {
    const className = active ? 'h-[22px] w-[22px]' : 'h-[22px] w-[22px]';
    if (icon === 'home') return <House className={className} />;
    if (icon === 'receipt_long') return <ReceiptText className={className} />;
    if (icon === 'bar_chart') return <ChartColumn className={className} />;
    return <UserIcon className={className} />;
  };

  return (
    <>
      <aside className="app-sidebar" aria-label="Primary navigation">
        <div className="desktop-sidebar-shell">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="desktop-sidebar-brand ui-icon-btn h-11 w-11 shrink-0 text-[var(--accent)]"
            aria-label="Open dashboard"
          >
            <Wallet className="h-5 w-5" />
          </button>

          <div className="desktop-sidebar-nav">
            {items.map((item) => {
              const active = current === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  className={cn('nav-sidebar-item', active && 'nav-sidebar-item-active')}
                  aria-label={item.label}
                >
                  <span className="nav-sidebar-icon">{renderNavigationIcon(item.icon, active)}</span>
                  <span className="sidebar-tooltip">{item.label}</span>
                </button>
              );
            })}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onPointerDown={handlePrimaryActionPressStart}
            onPointerUp={handlePrimaryActionPressEnd}
            onPointerCancel={handlePrimaryActionPressCancel}
            onPointerLeave={handlePrimaryActionPressCancel}
            onKeyDown={handlePrimaryActionKeyDown}
            className="desktop-sidebar-add nav-fab text-white"
            aria-label="Add expense"
          >
            <Plus className="h-6 w-6" />
          </motion.button>
        </div>
      </aside>

      <nav className="app-bottom-nav bottom-nav nav-dock" aria-label="Primary navigation">
        <div className="bottom-nav-inner">
          {items.slice(0, 2).map((item) => {
            const active = current === item.key;
            return (
              <motion.button
                key={item.key}
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => onNavigate(item.key)}
                className={cn(
                  'nav-item bottom-nav-item text-[10px] font-medium',
                  active && 'active',
                )}
                >
                  {renderNavigationIcon(item.icon, active)}
                  <span>{item.label}</span>
                </motion.button>
              );
          })}
          <div className="nav-fab-slot">
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onPointerDown={handlePrimaryActionPressStart}
              onPointerUp={handlePrimaryActionPressEnd}
              onPointerCancel={handlePrimaryActionPressCancel}
              onPointerLeave={handlePrimaryActionPressCancel}
              onKeyDown={handlePrimaryActionKeyDown}
              className="nav-fab text-white"
              aria-label="Add expense"
            >
              <Plus className="h-6 w-6" />
            </motion.button>
          </div>
          {items.slice(2).map((item) => {
            const active = current === item.key;
            return (
              <motion.button
                key={item.key}
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => onNavigate(item.key)}
                className={cn(
                  'nav-item bottom-nav-item text-[10px] font-medium',
                  active && 'active',
                )}
              >
                {renderNavigationIcon(item.icon, active)}
                <span>{item.label}</span>
              </motion.button>
            );
          })}
        </div>
      </nav>

    </>
  );
}

function ToastCard({ toast, onDismiss }: { key?: React.Key; toast: ToastItem; onDismiss: (id: string) => void }) {
  const [remainingMs, setRemainingMs] = useState(toast.durationMs);
  const [isPaused, setIsPaused] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (isPaused || dismissedRef.current) {
      return undefined;
    }

    if (remainingMs <= 0) {
      dismissedRef.current = true;
      onDismiss(toast.id);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setRemainingMs((current) => Math.max(0, current - 50));
    }, 50);

    return () => window.clearInterval(interval);
  }, [isPaused, onDismiss, remainingMs, toast.id]);

  const toneClasses = {
    info: 'border-secondary/20 bg-secondary/5 text-secondary',
    success: 'border-tertiary/20 bg-tertiary/5 text-tertiary',
    warning: 'border-yellow-500/20 bg-yellow-50 text-yellow-700',
    error: 'border-error/20 bg-error/5 text-error',
  }[toast.tone];

  const ToastIcon = toast.tone === 'success'
    ? CheckCircle2
    : toast.tone === 'warning'
      ? TriangleAlert
      : toast.tone === 'error'
        ? AlertCircle
        : Info;

  return (
    <div
      className={cn('relative overflow-hidden rounded-[1.25rem] border shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl', toneClasses)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-start gap-3 p-4">
        <ToastIcon className="mt-0.5 h-[22px] w-[22px] shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.message && <p className="mt-1 text-sm/6 opacity-80">{toast.message}</p>}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="rounded-full p-1 text-current/70 transition-colors hover:bg-surface-container-low/70"
          aria-label="Dismiss notification"
        >
          <X className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-black/5">
        <div
          className="h-full origin-left bg-current/40"
          style={{
            width: `${Math.max(0, (remainingMs / toast.durationMs) * 100)}%`,
            transition: isPaused ? 'none' : 'width 50ms linear',
          }}
        />
      </div>
    </div>
  );
}

export function ToastViewport({ items, onDismiss }: ToastViewportProps) {
  if (!items.length) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6">
      <div className="flex w-full max-w-md flex-col gap-2">
        {items.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

export function RevenueBars({ summary, isLoading }: SummaryStripProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-5/6" />
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const maxValue = Math.max(summary.totalThisMonth, summary.totalLastMonth, 1);
  const currentWidth = Math.min(100, (summary.totalThisMonth / maxValue) * 100);
  const previousWidth = Math.min(100, (summary.totalLastMonth / maxValue) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-on-surface">Month-over-month trend</p>
        <p className="text-sm text-on-surface-variant">{summary.trendPercent > 0 ? '+' : ''}{summary.trendPercent.toFixed(1)}%</p>
      </div>
      <div className="space-y-3">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-outline">
            <span>This month</span>
            <span>{prettyCurrency(summary.totalThisMonth)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-container-low">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${currentWidth}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-outline">
            <span>Last month</span>
            <span>{prettyCurrency(summary.totalLastMonth)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-container-low">
            <div className="h-full rounded-full bg-outline/30" style={{ width: `${previousWidth}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReportHeader({ title, description, range, onRangeChange, onExportCsv, exportLabel = 'Export CSV' }: {
  title: string;
  description: string;
  range: DateRangeValue;
  onRangeChange: (next: DateRangeValue) => void;
  onExportCsv: () => void;
  exportLabel?: string;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-outline">Reports</p>
        <h2 className="text-2xl font-semibold tracking-tight text-on-surface">{title}</h2>
        <p className="max-w-2xl text-sm leading-6 text-on-surface-variant">{description}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <DateRangePicker value={range} onChange={onRangeChange} className="sm:min-w-[18rem]" />
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onExportCsv}
          className="ui-btn ui-btn-secondary h-11"
        >
          <Download className="h-4 w-4" />
          {exportLabel}
        </motion.button>
      </div>
    </div>
  );
}

export function TopSummary({ user, preferences }: { user?: User | null; preferences?: UserPreferences | null }) {
  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-[linear-gradient(135deg,rgba(76,64,223,0.95),rgba(0,87,189,0.9))] p-5 text-white shadow-[0_24px_80px_rgba(76,64,223,0.24)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Account</p>
          <h3 className="text-2xl font-semibold tracking-tight">{user ? user.name : 'Your account'}</h3>
          <p className="max-w-xl text-sm leading-6 text-white/80">{user ? user.email : 'Connect authentication to personalize this workspace.'}</p>
        </div>
        <UserAvatar user={user} className="h-14 w-14 rounded-2xl bg-white/15 text-base" textClassName="text-base" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/65">Currency</p>
          <p className="mt-1 text-sm font-semibold">{preferences?.currency ?? 'Waiting on preferences'}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/65">Format</p>
          <p className="mt-1 text-sm font-semibold">{preferences?.dateFormat ?? 'Waiting on preferences'}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/65">Default category</p>
          <p className="mt-1 text-sm font-semibold">{preferences?.defaultCategoryId ? 'Configured' : 'Not set'}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/65">Appearance</p>
          <p className="mt-1 text-sm font-semibold">Saved on this device</p>
        </div>
      </div>
    </div>
  );
}

export function CategoryPills({ categories, activeId, onChange }: {
  categories: Category[];
  activeId: string | null;
  onChange: (categoryId: string | null) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'pill-filter flex shrink-0 items-center gap-2 border text-sm font-semibold transition-colors',
          activeId === null ? 'border-primary bg-primary/15 text-primary' : 'border-outline/10 bg-surface-container-low text-on-surface hover:bg-surface-container',
        )}
      >
        All categories
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onChange(category.id)}
          className={cn(
            'pill-filter flex shrink-0 items-center gap-2 border text-sm font-semibold transition-colors',
            activeId === category.id ? 'text-primary' : 'text-on-surface hover:bg-surface-container',
          )}
          style={{
            backgroundColor: activeId === category.id ? withAlpha(getCategoryColor(category.name), 0.16) : withAlpha(getCategoryColor(category.name), 0.1),
            borderColor: withAlpha(getCategoryColor(category.name), activeId === category.id ? 0.36 : 0.2),
          }}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getCategoryColor(category.name) }} />
          <span>{formatCategory(category.name)}</span>
        </button>
      ))}
    </div>
  );
}

export function RecentExpenseRow({ expense }: RecentExpenseItemProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[1.4rem] border border-outline/10 bg-surface-container-low/90 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.05)]">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: expense.category?.color ?? 'rgba(76,64,223,0.1)', color: expense.category?.color ?? 'currentColor' }}>
          {expense.category ? (
            React.createElement(getCategoryIcon(expense.category.icon), { className: 'h-5 w-5' })
          ) : (
            <span className="text-xl">•</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-on-surface">{expense.description || 'Untitled expense'}</p>
          <p className="truncate text-sm text-on-surface-variant">
            {prettyDate(expense.expenseDate)} {expense.category ? `· ${formatCategory(expense.category.name)}` : ''}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-on-surface">{prettyCurrency(expense.amount, expense.currency)}</p>
        <p className="text-xs uppercase tracking-[0.22em] text-outline">{expense.isRecurring ? 'Recurring' : expense.currency}</p>
      </div>
    </div>
  );
}

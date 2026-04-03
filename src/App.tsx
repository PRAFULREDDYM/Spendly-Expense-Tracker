/*
AUDIT FINDINGS
Q1. Files importing/calling Anthropic AI today: none. AI runtime files have been removed from `src/`, and the legacy backend folder has been deleted.
Q2. UI components rendering AI-related content today: none. No current route mounts chat, AI insights, parser UI, or AI integrations.
Q3. FX rates used to live in the dashboard hero/additional sections, but those live-rate widgets and conversions have now been removed from `Dashboard.tsx`.
Q4. Sidebar top spacing came from `/src/index.css` via `.app-sidebar` and `.desktop-sidebar-nav`; the cramped feel was caused by low top padding plus page headers starting too close to `var(--sat)`.
Q5. Current dark-mode root colors are the new premium finance palette in `/src/index.css`: `--bg #0F1117`, `--bg-card #181C25`, `--bg-card-2 #1E2230`, `--bg-elevated #252A38`, `--text-1 #E8EAF0`, `--text-2 #7C8196`, `--text-3 #484E63`, `--accent #2B7FFF`, `--green #22C55E`, `--red #EF4444`, `--amber #F59E0B`.
Q6. Supabase is now the source of truth again. The active app authenticates and syncs through Supabase, while Dexie-backed `src/db/*` helpers remain in place as the offline cache on each device.
Q7. The current bottom nav z-index is `1000` in `/src/index.css`.
Q8. The desktop header accessory is rendered in `headerAccessory` inside `/src/App.tsx`; it now only renders the avatar button, and the theme toggle has been removed from page headers.
*/
import React, {
  Suspense,
  lazy,
  useCallback,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftRight, ChevronRight, Plus, TrendingUp, Wallet } from 'lucide-react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import type { ScreenKey, ToastItem, DateRangeValue } from './components/shell';
import ErrorBoundary from './components/ErrorBoundary';
import BottomNav from './components/BottomNav';
import { DesktopBlocker } from './components/DesktopBlocker';
import type { ExpenseComposerDraft } from './components/AddTransaction';
import type { QuickAddExpense } from './components/QuickAdd';
import { SignIn, SignUp, Splash, SetupWorkspace } from './views/Auth';
import type { HistoryFiltersState } from './views/History';
import { buildInsights } from './services/insightEngine';
import { notificationService } from './services/notificationService';
import { EmptyState, ToastViewport, UserAvatar, buildDefaultRange, monthRange } from './components/shell';
import {
  buildExpenseInput,
  createExpenseDraftFromExpense,
} from './features';
import {
  useAppBootstrapQueries,
  useAuthSession,
  useBudgetMutations,
  useCategoryMutations,
  useCreateExpenseMutation,
  useDashboardSummaryQuery,
  useDeleteExpenseMutation,
  useDownloadExpenseCsvMutation,
  useExpensesQuery,
  useGroupMutations,
  useGroupsQuery,
  useRecurringMutations,
  useRecurringQuery,
  useRecurringRemindersQuery,
  useReportSummaryQuery,
  useUpdateExpenseMutation,
  useUpdateProfileMutation,
  useUpdatePreferencesMutation,
  useUploadAvatarMutation,
  useUploadReceiptMutation,
} from './hooks';
import { apiClient } from './api';
import { flushPendingWrites, pendingCount } from './services/syncQueue';
import type {
  BudgetInput,
  CategoryInput,
  Expense,
  ExpenseFilters,
  InsightItem,
  PreferencesInput,
} from './types';
import { getCategoryColor, withAlpha } from './lib/ui';
import { haptic, ImpactStyle } from './lib/native';
import { queryKeys } from './state/queryKeys';

const AddTransactionModal = lazy(() => import('./components/AddTransaction'));
const QuickAdd = lazy(() => import('./components/QuickAdd'));
const Dashboard = lazy(() => import('./views/Dashboard'));
const GroupDetail = lazy(() => import('./views/GroupDetail'));
const History = lazy(() => import('./views/History'));
const InvitePage = lazy(() => import('./views/InvitePage'));
const Analysis = lazy(() => import('./views/Analysis'));
const Profile = lazy(() => import('./views/Profile'));

// Keep the app-level handler to a single mutation attempt so one tap only
// produces one delete path and one toast on failure.

function toIsoStart(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

function toIsoEnd(date: string) {
  return new Date(`${date}T23:59:59.999Z`).toISOString();
}

function toScreen(pathname: string): ScreenKey {
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/analysis')) return 'analysis';
  if (pathname.startsWith('/profile')) return 'profile';
  return 'dashboard';
}

function createInitialHistoryFilters(): HistoryFiltersState {
  return {
    query: '',
    type: 'all',
    categoryId: null,
    range: buildDefaultRange(),
    minAmount: '',
    maxAmount: '',
  };
}

function createYearHistoryRange() {
  const now = new Date();
  return {
    preset: 'custom' as const,
    start: `${now.getFullYear()}-01-01`,
    end: `${now.getFullYear()}-12-31`,
  };
}

function getCurrencySymbol(currency: string) {
  const parts = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(0);

  return parts.find((part) => part.type === 'currency')?.value ?? '$';
}

function buildHistoryRangeFromAction(period?: string) {
  switch (period) {
    case 'today': {
      const today = new Date().toISOString().slice(0, 10);
      return {
        preset: 'custom' as const,
        start: today,
        end: today,
      };
    }
    case 'this-week':
      return buildDefaultRange();
    case 'this-month':
      return monthRange();
    case 'this-year':
      return createYearHistoryRange();
    default:
      return undefined;
  }
}

const quickTransferPad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

function updateQuickTransferAmount(current: string, key: typeof quickTransferPad[number]) {
  if (key === 'back') {
    return current.slice(0, -1);
  }

  if (key === '.') {
    if (current.includes('.')) return current;
    return current ? `${current}.` : '0.';
  }

  if (current === '0') {
    return key;
  }

  return `${current}${key}`;
}

function AppLoader() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[2rem] border border-outline/10 bg-surface-container-low/80 p-8 text-center shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mx-auto mb-4 h-14 w-14 animate-pulse rounded-2xl bg-primary/10" />
        <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Loading your workspace</h1>
        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
          Restoring your synced workspace, preferences, categories, and budgets.
        </p>
      </div>
    </main>
  );
}

function SyncStatusBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    const refreshCount = async () => {
      const nextCount = await pendingCount();
      if (active) {
        setCount(nextCount);
      }
    };

    void refreshCount();
    const interval = window.setInterval(() => {
      void refreshCount();
    }, 5_000);
    window.addEventListener('online', refreshCount);
    window.addEventListener('offline', refreshCount);
    window.addEventListener('sync-queue-changed', refreshCount as EventListener);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('online', refreshCount);
      window.removeEventListener('offline', refreshCount);
      window.removeEventListener('sync-queue-changed', refreshCount as EventListener);
    };
  }, []);

  if (count === 0 || (typeof navigator !== 'undefined' && navigator.onLine)) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 top-[calc(var(--sat)+12px)] z-[995] flex justify-center md:top-4">
      <div className="rounded-full border border-[var(--amber)]/25 bg-[var(--bg-elevated)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-1)] shadow-[var(--shadow-sm)]">
        {count} change{count !== 1 ? 's' : ''} pending sync
      </div>
    </div>
  );
}

function ProtectedRoute({
  isAuthenticated,
  isLoading,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <AppLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function getToastDuration(tone: ToastItem['tone']) {
  if (tone === 'success') return 3_000;
  if (tone === 'error') return 6_000;
  return 4_000;
}

function shouldSuppressWorkspaceCacheError(error: Error | null) {
  if (!error) {
    return false;
  }

  return (
    error.message.includes('Sign in and sync your workspace before using the offline cache.') ||
    error.message.includes('Sign in at least once on this device before using the offline cache.')
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function QuickActionSheet({
  open,
  categories,
  onClose,
  onAddExpense,
  onAddIncome,
  onQuickTransfer,
}: {
  open: boolean;
  categories: Array<{ id: string; name: string }>;
  onClose: () => void;
  onAddExpense: () => void;
  onAddIncome: () => void;
  onQuickTransfer: (draft: Partial<ExpenseComposerDraft>) => void;
}) {
  const [mode, setMode] = useState<'menu' | 'transfer'>('menu');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(categories[0]?.id ?? null);

  useEffect(() => {
    if (!open) {
      setMode('menu');
      setAmount('');
      setCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          <motion.section
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-[150] mx-auto w-full max-w-xl rounded-t-[24px] border border-outline/10 bg-surface-container-low px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 shadow-[var(--shadow)]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline/40" />

            {mode === 'menu' ? (
              <div className="space-y-4">
                <p className="text-center text-sm font-semibold uppercase tracking-[0.22em] text-on-surface-variant">Quick actions</p>
                <div className="grid gap-3">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={onAddExpense}
                    className="ui-btn ui-btn-primary flex items-center justify-between px-5 py-4 text-left text-white"
                  >
                    <div>
                      <p className="text-base font-semibold">Add expense</p>
                      <p className="mt-1 text-sm text-white/72">Open the full expense sheet.</p>
                    </div>
                    <Plus className="h-5 w-5" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={onAddIncome}
                    className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border-l-[3px] border-[var(--green)] bg-[var(--green-soft)] px-5 py-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--green-soft)] text-[var(--green)]">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-on-surface">Add income</p>
                        <p className="mt-1 text-[13px] text-on-surface-variant">Log salary, freelance, or a refund.</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-on-surface-variant" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => setMode('transfer')}
                    className="ui-btn ui-btn-secondary flex items-center justify-between px-5 py-4 text-left"
                  >
                    <div>
                      <p className="text-base font-semibold text-on-surface">Quick transfer</p>
                      <p className="mt-1 text-sm text-on-surface-variant">Pick a category and amount in one motion.</p>
                    </div>
                    <ArrowLeftRight className="h-5 w-5 text-primary" />
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setMode('menu')} className="text-sm font-medium text-on-surface-variant">
                    Back
                  </button>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-on-surface-variant">Quick transfer</p>
                  <div className="w-10" />
                </div>

                <div className="text-center">
                  <p className="text-[40px] font-bold tracking-[-0.03em] text-on-surface">{amount || '0.00'}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">Choose a recent category</p>
                </div>

                <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                  {categories.slice(0, 6).map((category) => {
                    const color = getCategoryColor(category.name);
                    const active = category.id === categoryId;
                    return (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        key={category.id}
                        type="button"
                        onClick={() => setCategoryId(category.id)}
                        className="flex shrink-0 flex-col items-center gap-2 rounded-[var(--radius-md)] border px-3 py-3"
                        style={{
                          borderColor: active ? withAlpha(color, 0.45) : 'var(--border)',
                          backgroundColor: active ? withAlpha(color, 0.16) : 'var(--bg-card-2)',
                        }}
                      >
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                          style={{ backgroundColor: withAlpha(color, 0.18), color }}
                        >
                          {category.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="max-w-16 truncate text-[11px] font-medium text-on-surface">{category.name}</span>
                      </motion.button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {quickTransferPad.map((key) => (
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      key={key}
                      type="button"
                      onClick={() => setAmount((current) => updateQuickTransferAmount(current, key))}
                      className="flex h-16 items-center justify-center rounded-[var(--radius-sm)] bg-surface-container text-2xl font-medium text-on-surface"
                    >
                      {key === 'back' ? '⌫' : key}
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => onQuickTransfer({ amount, categoryId, description: 'Quick transfer' })}
                  className="ui-btn ui-btn-primary h-14 w-full text-base"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </motion.button>
              </div>
            )}
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}

function AppContent() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [composerPreset, setComposerPreset] = useState<Partial<ExpenseComposerDraft> | null>(null);
  const [composerType, setComposerType] = useState<'expense' | 'income'>('expense');
  const [quickSheetOpen, setQuickSheetOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const deletingExpenseIdRef = useRef<string | null>(null);
  const [historyFilters, setHistoryFilters] = useState<HistoryFiltersState>(createInitialHistoryFilters);
  const [analysisRange, setAnalysisRange] = useState<DateRangeValue>(monthRange());
  const [toastState, setToastState] = useState<{ visible: ToastItem[]; queued: ToastItem[] }>({
    visible: [],
    queued: [],
  });

  const auth = useAuthSession();
  const bootstrap = useAppBootstrapQueries();
  const dashboardSummaryQuery = useDashboardSummaryQuery({
    enabled: auth.isAuthenticated,
  });
  const updatePreferencesMutation = useUpdatePreferencesMutation();
  const updateProfileMutation = useUpdateProfileMutation();
  const { createCategoryMutation, updateCategoryMutation, deleteCategoryMutation } = useCategoryMutations();
  const { createBudgetMutation, updateBudgetMutation, deleteBudgetMutation } = useBudgetMutations();
  const createExpenseMutation = useCreateExpenseMutation();
  const updateExpenseMutation = useUpdateExpenseMutation();
  const deleteExpenseMutation = useDeleteExpenseMutation();
  const groupsQuery = useGroupsQuery(auth.isAuthenticated);
  const {
    createGroupMutation,
    inviteMemberMutation,
    createGroupBudgetMutation,
    deleteGroupBudgetMutation,
    dismissReminderMutation,
    logReminderMutation,
    createRecurringMutation,
    updateRecurringMutation,
    deleteRecurringMutation,
  } = {
    ...useGroupMutations(),
    ...useRecurringMutations(),
  };
  const recurringQuery = useRecurringQuery(auth.isAuthenticated);
  const remindersQuery = useRecurringRemindersQuery(auth.isAuthenticated);
  const exportCsvMutation = useDownloadExpenseCsvMutation();
  const uploadReceiptMutation = useUploadReceiptMutation();
  const uploadAvatarMutation = useUploadAvatarMutation();

  const deferredQuery = useDeferredValue(historyFilters.query);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    void StatusBar.setStyle({ style: Style.Dark });
    void StatusBar.setBackgroundColor({ color: '#0F1117' });
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const keyboardWillShow = Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
    });
    const keyboardWillHide = Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    });

    return () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      void Promise.all([keyboardWillShow, keyboardWillHide]).then((handles) => {
        handles.forEach((handle) => handle.remove());
      });
    };
  }, []);

  useEffect(() => {
    if (!auth.isAuthenticated) {
      return;
    }

    void notificationService.rescheduleAll(recurringQuery.data ?? []);
  }, [auth.isAuthenticated, recurringQuery.data]);

  const expenseFilters = useMemo<ExpenseFilters>(
    () => ({
      range: {
        start: toIsoStart(historyFilters.range.start),
        end: toIsoEnd(historyFilters.range.end),
      },
      type: historyFilters.type,
      categoryIds: historyFilters.categoryId ? [historyFilters.categoryId] : undefined,
      minAmount: historyFilters.minAmount ? Number(historyFilters.minAmount) : undefined,
      maxAmount: historyFilters.maxAmount ? Number(historyFilters.maxAmount) : undefined,
      keyword: deferredQuery.trim() || undefined,
      sortBy: 'expenseDate',
      sortDirection: 'desc',
      page: 1,
      pageSize: 50,
    }),
    [historyFilters, deferredQuery],
  );

  const expensesQuery = useExpensesQuery(expenseFilters, {
    enabled: auth.isAuthenticated,
  });
  const allExpensesQuery = useExpensesQuery({
    sortBy: 'expenseDate',
    sortDirection: 'desc',
    page: 1,
    pageSize: 200,
    type: 'all',
  }, {
    enabled: auth.isAuthenticated,
  });

  const reportRange = useMemo(
    () => ({
      start: toIsoStart(analysisRange.start),
      end: toIsoEnd(analysisRange.end),
    }),
    [analysisRange],
  );

  const reportSummaryQuery = useReportSummaryQuery(reportRange, {
    enabled: auth.isAuthenticated,
  });

  const session = auth.session;
  const categories = bootstrap.categoriesQuery.data ?? [];
  const budgets = bootstrap.budgetsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const recurringExpenses = recurringQuery.data ?? [];
  const reminders = remindersQuery.data ?? [];
  const preferences = bootstrap.preferencesQuery.data ?? session?.user.preferences ?? null;
  const allExpenses = allExpensesQuery.data?.items ?? [];
  const currentScreen = toScreen(location.pathname);
  const isQuickAddRoute = location.pathname === '/quick-add';
  const isWatchAddRoute = location.pathname === '/watch-add';
  const quickAddVisible = auth.isAuthenticated && (quickAddOpen || isQuickAddRoute || isWatchAddRoute);
  const sharedQuickDescription = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('description')?.trim() ?? '';
  }, [location.search]);
  const currencySymbol = useMemo(() => getCurrencySymbol(preferences?.currency ?? 'USD'), [preferences?.currency]);
  const redirectAfter = useMemo(() => new URLSearchParams(location.search).get('redirect_after') || '/dashboard', [location.search]);
  const insightItems = useMemo<InsightItem[]>(
    () => buildInsights({
      expenses: allExpenses,
      budgets,
      recurringExpenses,
      reminders,
    }),
    [allExpenses, budgets, recurringExpenses, reminders],
  );
  const upcomingReminder = useMemo(() => {
    if (!reminders.length) return null;
    const recurringMap = new Map(recurringExpenses.map((item) => [item.id, item]));
    const sorted = [...reminders]
      .map((reminder) => ({ reminder, recurring: recurringMap.get(reminder.recurringExpenseId) ?? null }))
      .filter((item) => item.recurring)
      .sort((left, right) => left.reminder.dueDate.localeCompare(right.reminder.dueDate));
    return sorted[0] ?? null;
  }, [recurringExpenses, reminders]);
  const composerDraft = useMemo(() => {
    if (!editingExpense) {
      return composerPreset;
    }

    const draft = createExpenseDraftFromExpense(editingExpense);
    return {
      ...draft,
      amount: draft.amount,
      expenseDate: draft.expenseDate.slice(0, 10),
      receiptUrl: draft.receiptUrl,
      isRecurring: draft.isRecurring,
      recurrenceFrequency: draft.recurrenceFrequency,
      recurrenceInterval: draft.recurrenceInterval,
    };
  }, [composerPreset, editingExpense]);

  const pushToast = (title: string, message?: string, tone: ToastItem['tone'] = 'info') => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const nextToast: ToastItem = {
      id,
      title,
      message,
      tone,
      durationMs: getToastDuration(tone),
    };

    setToastState((current) =>
      current.visible.length < 3
        ? { ...current, visible: [...current.visible, nextToast] }
        : { ...current, queued: [...current.queued, nextToast] },
    );
  };

  const dismissToast = (id: string) => {
    setToastState((current) => {
      const visible = current.visible.filter((toast) => toast.id !== id);
      const queued = current.queued.filter((toast) => toast.id !== id);

      if (visible.length < current.visible.length && queued.length > 0) {
        const [nextToast, ...remainingQueue] = queued;
        return {
          visible: [...visible, nextToast],
          queued: remainingQueue,
        };
      }

      return {
        visible,
        queued,
      };
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentUses = Number.parseInt(window.localStorage.getItem('app_uses') ?? '0', 10);
    window.localStorage.setItem('app_uses', String(currentUses + 1));

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setInstallPromptEvent(promptEvent);
      const uses = Number.parseInt(window.localStorage.getItem('app_uses') ?? '0', 10);
      if (uses >= 3) {
        setShowInstallBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setShowInstallBanner(false);
      setInstallPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!auth.isAuthenticated || typeof window === 'undefined') {
      return;
    }

    const flushAndRefresh = async () => {
      await flushPendingWrites();
      await queryClient.invalidateQueries();
    };

    void flushAndRefresh();

    const handleOnline = () => {
      console.log('[Sync] Connection restored — flushing write queue');
      void flushAndRefresh();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [auth.isAuthenticated, queryClient]);

  useEffect(() => {
    if (!auth.isAuthenticated || isQuickAddRoute || isWatchAddRoute) {
      return;
    }

    const params = new URLSearchParams(location.search);
    if (params.get('quick') !== 'true') {
      return;
    }

    setQuickAddOpen(true);
    navigate(location.pathname, { replace: true });
  }, [auth.isAuthenticated, isQuickAddRoute, isWatchAddRoute, location.pathname, location.search, navigate]);

  useEffect(() => {
    const error =
      dashboardSummaryQuery.error ??
      expensesQuery.error ??
      reportSummaryQuery.error ??
      bootstrap.error ??
      null;

    if (error && !shouldSuppressWorkspaceCacheError(error)) {
      pushToast('Something needs attention', error.message, 'error');
    }
    // We intentionally only react to new error object references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dashboardSummaryQuery.error,
    expensesQuery.error,
    reportSummaryQuery.error,
    bootstrap.error,
  ]);

  useEffect(() => {
    const handleOpenExpenseSheet = (event: Event) => {
      const customEvent = event as CustomEvent<{
        type?: 'expense' | 'income';
        draft?: Partial<ExpenseComposerDraft> | null;
      }>;

      openComposer(
        undefined,
        customEvent.detail?.draft ?? null,
        customEvent.detail?.type ?? 'expense',
      );
    };

    window.addEventListener('open-expense-sheet', handleOpenExpenseSheet as EventListener);
    return () => {
      window.removeEventListener('open-expense-sheet', handleOpenExpenseSheet as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleTransactionAdded = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.root });
    };

    const handleCategoriesChanged = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.preferences });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.root });
    };

    window.addEventListener('transaction-added', handleTransactionAdded);
    window.addEventListener('categories-changed', handleCategoriesChanged);

    return () => {
      window.removeEventListener('transaction-added', handleTransactionAdded);
      window.removeEventListener('categories-changed', handleCategoriesChanged);
    };
  }, [queryClient]);

  useEffect(() => {
    if (location.pathname !== '/history' || !location.state) {
      return;
    }

    const state = location.state as { period?: string; category?: string } | null;
    if (!state?.period && !state?.category) {
      return;
    }

    const nextRange = buildHistoryRangeFromAction(state.period);
    const nextCategoryId =
      state.category
        ? categories.find((category) => category.name.trim().toLowerCase() === state.category?.trim().toLowerCase())?.id ?? null
        : null;

    setHistoryFilters((current) => ({
      ...current,
      categoryId: nextCategoryId,
      range: nextRange ?? current.range,
    }));

    navigate(location.pathname, { replace: true, state: null });
  }, [categories, location.pathname, location.state, navigate]);

  const openComposer = (
    expense?: Expense,
    preset?: Partial<ExpenseComposerDraft> | null,
    type: 'expense' | 'income' = expense?.type ?? 'expense',
  ) => {
    setEditingExpense(expense ?? null);
    setComposerPreset(expense ? null : (preset ?? null));
    setComposerType(type);
    setQuickSheetOpen(false);
    setQuickAddOpen(false);
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingExpense(null);
    setComposerPreset(null);
    setComposerType('expense');
  };

  const handleSetupWorkspace = async (values: { name: string; currency: PreferencesInput['currency'] }) => {
    try {
      const session = await apiClient.auth.setup(values);
      queryClient.setQueryData(queryKeys.session, session);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.preferences }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.root }),
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets.root }),
      ]);
      pushToast('Workspace ready', 'Your cloud workspace is ready and cached offline on this device.', 'success');
      startTransition(() => navigate('/dashboard', { replace: true }));
    } catch (error) {
      pushToast('Could not set up workspace', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleLogin = async (values: { email: string; password: string; name?: string }) => {
    try {
      const sessionValue = await auth.login(values);
      queryClient.setQueryData(queryKeys.session, sessionValue);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.preferences }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.root }),
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets.root }),
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses.root }),
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.root }),
        queryClient.invalidateQueries({ queryKey: queryKeys.recurring.root }),
      ]);
      pushToast('Signed in', 'Your synced workspace is ready on this device.', 'success');
      startTransition(() => navigate(redirectAfter, { replace: true }));
    } catch (error) {
      pushToast('Could not sign in', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleSignUp = async (values: { email: string; password: string; name?: string }) => {
    try {
      const sessionValue = await auth.signUp(values);
      queryClient.setQueryData(queryKeys.session, sessionValue);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.preferences }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.root }),
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets.root }),
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses.root }),
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.root }),
        queryClient.invalidateQueries({ queryKey: queryKeys.recurring.root }),
      ]);
      pushToast('Account created', 'Your workspace now syncs across your signed-in devices.', 'success');
      startTransition(() => navigate(redirectAfter, { replace: true }));
    } catch (error) {
      pushToast('Could not create account', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await auth.loginWithGoogle(redirectAfter);
    } catch (error) {
      pushToast('Could not start Google sign-in', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const createRecurringFromExpenseDraft = useCallback(async (draft: ExpenseComposerDraft) => {
    if (!draft.isRecurring) {
      return;
    }

    const amount = Number(draft.amount || '0');
    if (amount <= 0) {
      return;
    }

    const existing = recurringExpenses.find((item) =>
      item.name.trim().toLowerCase() === draft.description.trim().toLowerCase()
      && item.amount === amount
      && item.frequency === draft.recurrenceFrequency,
    );

    if (existing) {
      return;
    }

    const dueDate = draft.expenseDate.slice(0, 10);
    await createRecurringMutation.mutateAsync({
      name: draft.description,
      amount,
      currency: draft.currency,
      categoryId: draft.categoryId,
      frequency: draft.recurrenceFrequency,
      dayOfMonth: draft.recurrenceFrequency === 'monthly' ? new Date(`${dueDate}T00:00:00`).getDate() : null,
      dayOfWeek: draft.recurrenceFrequency === 'weekly' ? new Date(`${dueDate}T00:00:00`).getDay() : null,
      nextDue: dueDate,
      reminderDaysBefore: 1,
      autoLog: false,
      active: true,
    });
  }, [createRecurringMutation, recurringExpenses]);

  const handleSaveExpense = async (draft: ExpenseComposerDraft) => {
    try {
      const submission = buildExpenseInput({
        id: editingExpense?.id,
        amount: draft.amount,
        currency: draft.currency,
        categoryId: draft.categoryId,
        groupId: draft.groupId ?? null,
        description: draft.description,
        expenseDate: toIsoStart(draft.expenseDate),
        receiptUrl: draft.receiptUrl,
        isRecurring: draft.isRecurring,
        recurrenceFrequency: draft.recurrenceFrequency,
        recurrenceInterval: draft.recurrenceInterval,
        nextOccurrenceDate: '',
      }, {
        primaryCurrency: preferences?.currency,
      });
      submission.input.type = editingExpense?.type ?? composerType;

      if (editingExpense) {
        await updateExpenseMutation.mutateAsync({
          expenseId: editingExpense.id,
          input: submission.input,
        });
        await createRecurringFromExpenseDraft(draft);
        await haptic(ImpactStyle.Medium);
        pushToast('Expense updated', 'The transaction was saved to your account.', 'success');
      } else {
        await createExpenseMutation.mutateAsync(submission.input);
        await createRecurringFromExpenseDraft(draft);
        await haptic(ImpactStyle.Medium);
        pushToast('Expense saved', 'The transaction is now part of your history.', 'success');
      }

      closeComposer();
    } catch (error) {
      pushToast('Could not save expense', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (deletingExpenseIdRef.current === expense.id || deletingExpenseId === expense.id) {
      return;
    }

    deletingExpenseIdRef.current = expense.id;
    setDeletingExpenseId(expense.id);

    try {
      const sessionExpiry = auth.session?.expiresAt ? new Date(auth.session.expiresAt).getTime() : 0;
      if (sessionExpiry && sessionExpiry <= Date.now() + 30_000) {
        await auth.refresh();
      }
      await deleteExpenseMutation.mutateAsync(expense.id);
      await haptic(ImpactStyle.Heavy);
      pushToast('Expense deleted', 'The transaction was removed.', 'success');
    } catch (error) {
      pushToast('Could not delete expense', error instanceof Error ? error.message : 'Please try again.', 'error');
    } finally {
      deletingExpenseIdRef.current = null;
      setDeletingExpenseId(null);
    }
  };

  const handlePrimaryFabTap = () => {
    setQuickSheetOpen(true);
  };

  const handleCloseQuickAdd = () => {
    setQuickAddOpen(false);

    if (isQuickAddRoute || isWatchAddRoute) {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleQuickAddSave = async (expense: QuickAddExpense) => {
    try {
      await createExpenseMutation.mutateAsync({
        categoryId: expense.categoryId,
        groupId: expense.groupId ?? null,
        amount: expense.amount,
        currency: preferences?.currency ?? 'USD',
        expenseDate: new Date().toISOString(),
        description: expense.description,
        type: 'expense',
        receiptUrl: null,
        isRecurring: false,
        recurringConfig: null,
      });
      window.dispatchEvent(new CustomEvent('transaction-added'));
      await haptic(ImpactStyle.Medium);
      pushToast('Expense saved', 'Your quick entry is now in your history.', 'success');
      handleCloseQuickAdd();
    } catch (error) {
      pushToast('Could not save expense', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleCreateGroup = async (name: string) => {
    try {
      const group = await createGroupMutation.mutateAsync(name);
      pushToast('Shared budget created', 'You can now invite members and tag shared expenses.', 'success');
      navigate(`/groups/${group.id}`);
    } catch {
      pushToast('Could not save', 'Check your connection.', 'error');
    }
  };

  const handleInviteGroupMember = async (groupId: string, email: string) => {
    try {
      const invite = await inviteMemberMutation.mutateAsync({ groupId, email });
      if (invite.shareUrl && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(invite.shareUrl);
      }
      pushToast('Invite ready', 'The invite link was copied so you can share it manually.', 'success');
    } catch {
      pushToast('Could not save. Check your connection.', undefined, 'error');
    }
  };

  const handleReminderDismiss = async (reminderId: string) => {
    try {
      await dismissReminderMutation.mutateAsync(reminderId);
    } catch {
      pushToast('Could not save. Check your connection.', undefined, 'error');
    }
  };

  const handleReminderLog = async (reminderId: string) => {
    try {
      await logReminderMutation.mutateAsync({ id: reminderId });
      pushToast('Payment logged', 'The recurring expense moved to its next cycle.', 'success');
    } catch {
      pushToast('Could not save. Check your connection.', undefined, 'error');
    }
  };

  const handleLogRecurring = async (recurringId: string) => {
    const recurring = recurringExpenses.find((item) => item.id === recurringId);
    if (!recurring) {
      return;
    }

    try {
      const reminder = reminders.find((item) => item.recurringExpenseId === recurringId && !item.logged);
      if (reminder) {
        await logReminderMutation.mutateAsync({ id: reminder.id, amount: recurring.amount });
      } else {
        await apiClient.recurring.logReminder('', recurring.amount);
      }
      pushToast('Payment logged', 'The recurring expense moved to its next cycle.', 'success');
    } catch {
      pushToast('Could not save. Check your connection.', undefined, 'error');
    }
  };

  const handleRecurringDelete = async (recurringId: string) => {
    try {
      await deleteRecurringMutation.mutateAsync(recurringId);
      pushToast('Recurring expense deleted', 'It will no longer create reminders.', 'success');
    } catch {
      pushToast('Could not save. Check your connection.', undefined, 'error');
    }
  };

  const handleRecurringPauseToggle = async (recurringId: string, active: boolean) => {
    try {
      await updateRecurringMutation.mutateAsync({ id: recurringId, input: { active: !active } });
      pushToast(active ? 'Recurring expense paused' : 'Recurring expense resumed', 'Your reminder schedule was updated.', 'success');
    } catch {
      pushToast('Could not save. Check your connection.', undefined, 'error');
    }
  };

  const handleExportHistoryCsv = async () => {
    try {
      await exportCsvMutation.mutateAsync(expenseFilters);
      pushToast('CSV exported', 'Your filtered transaction export has started.', 'success');
    } catch (error) {
      pushToast('CSV export failed', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleExportAnalysisCsv = async () => {
    try {
      await exportCsvMutation.mutateAsync({
        range: reportRange,
        sortBy: 'expenseDate',
        sortDirection: 'desc',
      });
      pushToast('CSV exported', 'Your report export has started.', 'success');
    } catch (error) {
      pushToast('CSV export failed', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleUploadReceipt = async (file: File) => {
    const url = await uploadReceiptMutation.mutateAsync(file);
    pushToast('Receipt attached', 'The image is uploaded to your synced account and cached locally.', 'success');
    return url;
  };

  const handleSavePreferences = async (input: PreferencesInput) => {
    if (
      preferences &&
      input.currency === preferences.currency &&
      input.dateFormat === preferences.dateFormat &&
      input.defaultCategoryId === preferences.defaultCategoryId
    ) {
      return;
    }

    try {
      await updatePreferencesMutation.mutateAsync(input);
      pushToast('Preferences saved', 'Your defaults were synced to your account.', 'success');
    } catch (error) {
      pushToast('Could not save preferences', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleUploadAvatar = async (file: File) => {
    const url = await uploadAvatarMutation.mutateAsync(file);
    await updateProfileMutation.mutateAsync({ avatarUrl: url });
    pushToast('Profile picture updated', 'Your avatar was uploaded and synced across devices.', 'success');
    return url;
  };

  const handleSaveProfile = async (input: { avatarUrl?: string | null }) => {
    try {
      await updateProfileMutation.mutateAsync(input);
      pushToast('Profile updated', 'Your account details were updated successfully.', 'success');
    } catch (error) {
      pushToast('Could not update profile', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleCreateCategory = async (input: CategoryInput) => {
    try {
      const created = await createCategoryMutation.mutateAsync(input);
      pushToast('Category created', 'It is now available in the expense composer and budget forms.', 'success');
      return created;
    } catch (error) {
      pushToast('Could not create category', error instanceof Error ? error.message : 'Please try again.', 'error');
      throw error;
    }
  };

  const handleUpdateCategory = async (categoryId: string, input: CategoryInput) => {
    try {
      await updateCategoryMutation.mutateAsync({ categoryId, input });
      pushToast('Category updated', 'Your changes were saved.', 'success');
    } catch (error) {
      pushToast('Could not update category', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await deleteCategoryMutation.mutateAsync(categoryId);
      pushToast('Category deleted', 'Existing expenses were left intact and moved to uncategorized if needed.', 'success');
    } catch (error) {
      pushToast('Could not delete category', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleCreateBudget = async (input: BudgetInput) => {
    try {
      await createBudgetMutation.mutateAsync(input);
      pushToast('Budget created', 'Budget tracking is now live for that scope and month.', 'success');
    } catch (error) {
      pushToast('Could not create budget', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleUpdateBudget = async (budgetId: string, input: BudgetInput) => {
    try {
      await updateBudgetMutation.mutateAsync({ budgetId, input });
      pushToast('Budget updated', 'The new target is now active.', 'success');
    } catch (error) {
      pushToast('Could not update budget', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    try {
      await deleteBudgetMutation.mutateAsync(budgetId);
      pushToast('Budget deleted', 'The budget was removed from the current workspace.', 'success');
    } catch (error) {
      pushToast('Could not delete budget', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.logout();
      await queryClient.invalidateQueries();
      startTransition(() => navigate('/login', { replace: true }));
      pushToast('Signed out', 'You can sign back in anytime on this or another device.', 'success');
    } catch (error) {
      pushToast('Could not sign out', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const handleResetData = async () => {
    try {
      await apiClient.workspace.resetAllData();
      await queryClient.invalidateQueries();
      startTransition(() => navigate('/dashboard', { replace: true }));
      pushToast('Workspace reset', 'Your account data was cleared and the empty workspace is ready to sync again.', 'success');
    } catch (error) {
      pushToast('Could not reset data', error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };

  const showBottomNav =
    auth.isAuthenticated && ['/dashboard', '/history', '/analysis', '/profile'].some((path) => location.pathname.startsWith(path));

  const handleInstallApp = async () => {
    if (!installPromptEvent) {
      return;
    }

    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setShowInstallBanner(false);
      setInstallPromptEvent(null);
    }
  };

  const headerAccessory = session?.user ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => navigate('/profile')}
        className="ui-icon-btn rounded-full p-0"
        aria-label="Open profile"
      >
        <UserAvatar user={session.user} className="header-avatar h-8 w-8 text-[11px]" textClassName="text-[11px]" />
      </button>
    </div>
  ) : null;

  const profileHeaderAccessory = session?.user ? (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => navigate('/profile')}
        className="ui-icon-btn rounded-full p-0"
        aria-label="Open profile"
      >
        <UserAvatar user={session.user} className="header-avatar h-10 w-10 text-[12px]" textClassName="text-[12px]" />
      </button>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="rounded-full border border-[var(--border-md)] bg-[var(--bg-card)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-2)] shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        aria-label="Sign out"
      >
        Sign out
      </button>
    </div>
  ) : null;

  return (
    <div className="app-shell app-layout relative min-h-screen overflow-x-hidden text-on-surface">
      <SyncStatusBadge />
      <ToastViewport items={toastState.visible} onDismiss={dismissToast} />

      <>

      {showBottomNav && !isQuickAddRoute && showInstallBanner && installPromptEvent ? (
        <div className="fixed inset-x-4 bottom-[calc(var(--nav-total)+12px)] z-[980] md:hidden">
          <div className="flex items-center gap-3 rounded-[18px] border border-[var(--border-md)] bg-[var(--bg-elevated)] px-4 py-3 shadow-[var(--shadow)]">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text-1)]">Install app for the best experience</p>
              <p className="text-[12px] text-[var(--text-2)]">Launch it like a native app from your home screen.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleInstallApp()}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Install
            </button>
            <button
              type="button"
              onClick={() => setShowInstallBanner(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--text-2)]"
              aria-label="Dismiss install prompt"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>
      ) : null}

      {showBottomNav && !isQuickAddRoute ? (
        <BottomNav
          currentScreen={currentScreen}
          onNavigate={(screen) => {
            void haptic(ImpactStyle.Light);
            const nextPath =
              screen === 'dashboard'
                ? '/dashboard'
                : screen === 'history'
                  ? '/history'
                  : screen === 'analysis'
                    ? '/analysis'
                    : '/profile';
            navigate(nextPath);
          }}
          onPrimaryAction={handlePrimaryFabTap}
          onPrimaryActionLongPress={() => openComposer()}
        />
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
      <motion.div key={location.pathname} className="app-main relative flex-1 overflow-x-hidden">
      <Suspense fallback={<AppLoader />}>
      <Routes location={location}>
        <Route
          path="/"
          element={
            auth.sessionQuery.isLoading ? (
              <AppLoader />
            ) : auth.isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/welcome" replace />
            )
          }
        />
        <Route
          path="/welcome"
          element={
            auth.isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Splash
                onStart={() => navigate('/signup')}
                onPreviewWorkspace={() => navigate('/login')}
              />
            )
          }
        />
        <Route
          path="/setup"
          element={
            !auth.isAuthenticated ? (
              <Navigate to="/login" replace />
            ) : (
              <SetupWorkspace
                onSubmit={(values) => void handleSetupWorkspace(values)}
                isSubmitting={auth.loginMutation.isPending || auth.signUpMutation.isPending}
              />
            )
          }
        />
        <Route
          path="/login"
          element={
            auth.isAuthenticated ? (
              <Navigate to={redirectAfter} replace />
            ) : (
              <SignIn
                onSubmit={(values) => void handleLogin(values)}
                onGoogleSignIn={() => void handleGoogleSignIn()}
                onSwitchMode={() => navigate('/signup')}
                onPreviewWorkspace={() => navigate('/signup')}
                isSubmitting={auth.loginMutation.isPending}
                isGoogleSubmitting={auth.googleLoginMutation?.isPending}
              />
            )
          }
        />
        <Route
          path="/signup"
          element={
            auth.isAuthenticated ? (
              <Navigate to={redirectAfter} replace />
            ) : (
              <SignUp
                onSubmit={(values) => void handleSignUp(values)}
                onGoogleSignIn={() => void handleGoogleSignIn()}
                onSwitchMode={() => navigate('/login')}
                onPreviewWorkspace={() => navigate('/login')}
                isSubmitting={auth.signUpMutation.isPending}
                isGoogleSubmitting={auth.googleLoginMutation?.isPending}
              />
            )
          }
        />
        <Route
          path="/invite"
          element={<InvitePage isAuthenticated={auth.isAuthenticated} />}
        />
        <Route
          element={
            <ProtectedRoute
              isAuthenticated={auth.isAuthenticated}
              isLoading={auth.sessionQuery.isLoading || bootstrap.isLoading}
            />
          }
        >
          <Route
            path="/dashboard"
            element={
              <Dashboard
                user={session?.user}
                preferences={preferences}
                summary={dashboardSummaryQuery.data}
                recentExpenses={dashboardSummaryQuery.data?.recentExpenses}
                budgets={budgets}
                categories={categories}
                groups={groups}
                recurringExpenses={recurringExpenses}
                reminders={reminders}
                insights={insightItems}
                isLoading={dashboardSummaryQuery.isLoading || bootstrap.isLoading}
                headerAccessory={headerAccessory}
                onOpenExpenseComposer={() => openComposer()}
                onOpenQuickTransfer={() => setQuickSheetOpen(true)}
                onNavigateHistory={() => navigate('/history')}
                onNavigateReports={() => navigate('/analysis')}
                onNavigateBudgets={() => navigate('/profile')}
                onOpenGroup={(groupId) => navigate(`/groups/${groupId}`)}
                onLogRecurring={(recurringId) => void handleLogRecurring(recurringId)}
                onToggleRecurringActive={(recurringId, active) => void handleRecurringPauseToggle(recurringId, active)}
                onDeleteRecurring={(recurringId) => void handleRecurringDelete(recurringId)}
                onDismissReminder={(reminderId) => void handleReminderDismiss(reminderId)}
                onLogReminder={(reminderId) => void handleReminderLog(reminderId)}
              />
            }
          />
          <Route
            path="/groups/:groupId"
            element={<GroupDetail currentUser={session?.user} />}
          />
          <Route path="/quick-add" element={<div className="min-h-screen bg-[var(--bg)]" />} />
          <Route path="/watch-add" element={<div className="min-h-screen bg-[var(--bg)]" />} />
          <Route
            path="/history"
            element={
              <History
                expenses={expensesQuery.data?.items ?? []}
                totalCount={expensesQuery.data?.total ?? 0}
                categories={categories}
                preferences={preferences}
                filters={historyFilters}
                isLoading={expensesQuery.isLoading}
                isExportingCsv={exportCsvMutation.isPending}
                headerAccessory={headerAccessory}
                onFiltersChange={setHistoryFilters}
                onOpenExpenseComposer={() => openComposer()}
                onExportCsv={() => void handleExportHistoryCsv()}
                onEditExpense={(expense) => openComposer(expense)}
                deletingExpenseId={deletingExpenseId}
                onDeleteExpense={(expense) => handleDeleteExpense(expense)}
              />
            }
          />
          <Route
            path="/analysis"
            element={
              <Analysis
                report={reportSummaryQuery.data}
                range={analysisRange}
                isLoading={reportSummaryQuery.isLoading}
                isExportingCsv={exportCsvMutation.isPending}
                headerAccessory={headerAccessory}
                categories={categories}
                budgets={budgets}
                onRangeChange={setAnalysisRange}
                onExportCsv={() => void handleExportAnalysisCsv()}
              />
            }
          />
          <Route
            path="/profile"
            element={
              <Profile
                user={session?.user}
                preferences={preferences}
                categories={categories}
                budgets={budgets}
                groups={groups}
                expenseCount={expensesQuery.data?.total ?? 0}
                isLoading={bootstrap.isLoading}
                isSavingPreferences={updatePreferencesMutation.isPending}
                isSavingProfile={updateProfileMutation.isPending}
                isSavingCategory={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                isSavingBudget={createBudgetMutation.isPending || updateBudgetMutation.isPending}
                isUploadingAvatar={uploadAvatarMutation.isPending}
                headerAccessory={profileHeaderAccessory}
                onSignOut={() => void handleSignOut()}
                onSavePreferences={(input) => void handleSavePreferences(input)}
                onSaveProfile={(input) => void handleSaveProfile(input)}
                onUploadAvatar={(file) => handleUploadAvatar(file)}
                onCreateCategory={(input) => void handleCreateCategory(input)}
                onUpdateCategory={(categoryId, input) => void handleUpdateCategory(categoryId, input)}
                onDeleteCategory={(categoryId) => void handleDeleteCategory(categoryId)}
                onCreateBudget={(input) => void handleCreateBudget(input)}
                onUpdateBudget={(budgetId, input) => void handleUpdateBudget(budgetId, input)}
                onDeleteBudget={(budgetId) => void handleDeleteBudget(budgetId)}
                onCreateGroup={(name) => void handleCreateGroup(name)}
                onInviteGroupMember={(groupId, email) => void handleInviteGroupMember(groupId, email)}
                onOpenGroup={(groupId) => navigate(`/groups/${groupId}`)}
              />
            }
          />
        </Route>
        <Route
          path="/privacy"
          element={
            <div className="page-wrapper page-content min-h-screen bg-[var(--bg)] px-5 py-10 text-[var(--text-1)]">
              <div className="mx-auto max-w-2xl space-y-4 rounded-[var(--r-lg)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-sm)]">
                <h1 className="text-[24px] font-bold tracking-[-0.02em]">Privacy</h1>
                <p className="text-[15px] leading-7 text-[var(--text-2)]">
                  Your account data syncs through Supabase so the same workspace is available on
                  phone, tablet, and laptop. Each signed-in device also keeps an offline cache for
                  fast access when connectivity is limited. We do not sell or share your financial
                  data with third parties.
                </p>
              </div>
            </div>
          }
        />
        <Route
          path="*"
          element={
            <EmptyState
              icon="search_off"
              title="Page not found"
              description="The route you requested does not exist in this workspace."
              action={{ label: 'Go to dashboard', onClick: () => navigate('/dashboard'), icon: 'home' }}
            />
          }
        />
      </Routes>
      </Suspense>
      </motion.div>
      </AnimatePresence>

      <QuickActionSheet
        open={quickSheetOpen}
        categories={categories}
        onClose={() => setQuickSheetOpen(false)}
        onAddExpense={() => openComposer()}
        onAddIncome={() => openComposer(undefined, null, 'income')}
        onQuickTransfer={(preset) => openComposer(undefined, preset)}
      />

      {quickAddVisible ? (
        <Suspense fallback={null}>
          <QuickAdd
            isOpen={quickAddVisible}
            categories={categories.map((category) => ({
              id: category.id,
              name: category.name,
              color: category.color,
            }))}
            groups={groups.map((group) => ({
              id: group.id,
              name: group.name,
            }))}
            currencySymbol={currencySymbol}
            compact={isWatchAddRoute}
            initialDescription={sharedQuickDescription}
            onClose={handleCloseQuickAdd}
            onSave={handleQuickAddSave}
            onOpenProfile={() => navigate('/profile')}
          />
        </Suspense>
      ) : null}

      <Suspense fallback={null}>
        <AddTransactionModal
          open={composerOpen}
          categories={categories}
          groups={groups.map((group) => ({ id: group.id, name: group.name }))}
          defaultCurrency={preferences?.currency ?? 'USD'}
          initialDraft={composerDraft}
          heading={editingExpense ? 'Edit expense' : composerPreset?.description === 'Quick transfer' ? 'Quick transfer' : composerType === 'income' ? 'New income' : 'New expense'}
          submitLabel={editingExpense ? 'Update expense' : composerPreset?.description === 'Quick transfer' ? 'Save transfer' : 'Save expense'}
          isSaving={createExpenseMutation.isPending || updateExpenseMutation.isPending}
          isUploadingReceipt={uploadReceiptMutation.isPending}
          onClose={closeComposer}
          onSave={handleSaveExpense}
          onUploadReceipt={handleUploadReceipt}
          onCreateCategory={(input) => handleCreateCategory(input)}
        />
      </Suspense>
        </>
    </div>
  );
}

export default function App() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth > 768);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!Capacitor.isNativePlatform() && isDesktop) {
    return (
      <ErrorBoundary onReset={() => window.location.reload()}>
        <DesktopBlocker />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <AppContent />
    </ErrorBoundary>
  );
}

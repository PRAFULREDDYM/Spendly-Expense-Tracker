import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ChartNoAxesColumn,
  Database,
  Eye,
  EyeOff,
  Lock,
  Mail,
  SkipForward,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet,
  User,
} from 'lucide-react';
import type { UserPreferences } from '../types';
import CustomSelect from '../components/ui/CustomSelect';
import { CURRENCIES } from '../constants/currencies';

export interface AuthFormValues {
  email: string;
  password: string;
  name?: string;
}

export interface AuthScreenProps {
  mode?: 'signin' | 'signup';
  onSubmit?: (values: AuthFormValues) => void;
  onGoogleSignIn?: () => void;
  onSwitchMode?: (mode: 'signin' | 'signup') => void;
  onPreviewWorkspace?: () => void;
  isSubmitting?: boolean;
  isGoogleSubmitting?: boolean;
  error?: string | null;
}

export interface SplashProps {
  onStart?: () => void;
  onPreviewWorkspace?: () => void;
}

export interface SetupWorkspaceProps {
  onSubmit?: (values: { name: string; currency: UserPreferences['currency'] }) => void | Promise<void>;
  isSubmitting?: boolean;
}

const onboardingKey = 'onboarding_complete';

const onboardingSlides = [
  {
    key: 'spending',
    title: 'Track income, expenses & savings',
    subtitle: 'Log every transaction, see your savings auto-calculated as income minus expenses, and spot patterns instantly.',
    icon: Wallet,
  },
  {
    key: 'budget',
    title: 'Budgets, categories & receipts',
    subtitle: 'Set monthly limits per category, attach receipt photos manually, and watch budget progress in real time.',
    icon: Target,
  },
  {
    key: 'tracking',
    title: 'Synced mobile tracking',
    subtitle: 'Use quick add shortcuts, keep an offline cache on every device, and pick up the same workspace on phone, tablet, or laptop.',
    icon: ChartNoAxesColumn,
  },
] as const;

type AuthInputProps = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder: string;
  autoComplete?: string;
  trailing?: React.ReactNode;
};

function AuthInput({
  label,
  icon: Icon,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  trailing,
}: AuthInputProps) {
  return (
    <label className="block space-y-2">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-2)]">{label}</span>
      <div className="flex h-12 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-md)] bg-[var(--bg-card)] px-4 text-[var(--text-1)] transition-all focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--accent-soft)]">
        <Icon className="h-4 w-4 shrink-0 text-[var(--text-2)]" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-3)]"
        />
        {trailing}
      </div>
    </label>
  );
}

const showcaseCards = [
  {
    icon: ShieldCheck,
    title: 'Private cloud sync',
    body: 'Your account syncs securely through Supabase while each signed-in device keeps an offline cache for fast everyday use.',
  },
  {
    icon: Sparkles,
    title: 'Built for quick mobile entry',
    body: 'Open Quick Add from your home screen, log expenses in three taps, and keep the whole experience focused on mobile speed.',
  },
  {
    icon: Database,
    title: 'Income, expenses & savings',
    body: 'Track every transaction with auto-calculated savings, multi-currency support, recurring expenses, and detailed reports.',
  },
] as const;

const setupCurrencyOptions = CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.name} (${currency.symbol})`,
}));

function GoogleMark() {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#4285F4] shadow-[inset_0_0_0_1px_rgba(66,133,244,0.14)]">
      G
    </span>
  );
}

function AuthForm({
  mode = 'signin',
  onSubmit,
  onGoogleSignIn,
  onSwitchMode,
  onPreviewWorkspace,
  isSubmitting,
  isGoogleSubmitting,
  error,
}: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === 'signup';

  return (
    <main className="min-h-screen bg-[var(--bg)] lg:grid lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--bg)] px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute left-[-6rem] top-[-4rem] h-72 w-72 rounded-full bg-[var(--accent-soft)] blur-3xl" />
          <div className="absolute bottom-[-5rem] right-[-3rem] h-80 w-80 rounded-full bg-[var(--blue-soft)] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-[0_10px_26px_var(--accent-glow)]">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--text-1)]">Expense Tracker</p>
                <p className="text-xs text-[var(--text-2)]">Synced finance workspace</p>
              </div>
            </div>
          </div>

          <div className="mt-10 max-w-lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-2)]">{isSignup ? 'Create your account' : 'Welcome back'}</p>
            <h1 className="mt-4 text-[34px] font-bold tracking-[-0.03em] text-[var(--text-1)] sm:text-[40px]">
              {isSignup ? 'Create your finance workspace.' : 'Welcome back to your workspace.'}
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--text-2)] sm:text-base">
              {isSignup
                ? 'Create an account to sync expenses, budgets, receipts, and savings across every device you sign into.'
                : 'Pick up where you left off with the same synced workspace on phone, tablet, or laptop.'}
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-8 w-full max-w-xl rounded-[24px] border border-[var(--border-md)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow)] sm:p-6"
          >
            {error && (
              <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--red-soft)] bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red)]">
                <p className="font-semibold">Authentication error</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={onGoogleSignIn}
              disabled={isSubmitting || isGoogleSubmitting}
              className="ui-btn ui-btn-secondary h-14 w-full justify-center gap-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleMark />
              {isGoogleSubmitting ? 'Redirecting to Google…' : 'Continue with Google'}
            </motion.button>

            <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span>Email</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit?.({ email, password, name: isSignup ? name : undefined });
              }}
            >
              {isSignup && (
                <AuthInput
                  label="Name"
                  icon={User}
                  value={name}
                  onChange={setName}
                  placeholder="Your full name"
                  autoComplete="name"
                />
              )}

              <AuthInput
                label="Email address"
                icon={Mail}
                value={email}
                onChange={setEmail}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
              />

              <AuthInput
                label="Password"
                icon={Lock}
                value={password}
                onChange={setPassword}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-1)]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="submit"
                  disabled={isSubmitting || isGoogleSubmitting}
                  className="ui-btn ui-btn-primary h-14 flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSignup ? 'Create account' : 'Sign in'}
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
                {onPreviewWorkspace && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={onPreviewWorkspace}
                    className="ui-btn ui-btn-secondary h-14 flex-1"
                  >
                    Preview workspace
                  </motion.button>
                )}
              </div>
            </form>

            <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[var(--text-2)]">{isSignup ? 'Already have an account?' : 'Need a new account?'}</p>
              <button
                type="button"
                onClick={() => onSwitchMode?.(isSignup ? 'signin' : 'signup')}
                className="font-semibold text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
              >
                {isSignup ? 'Sign in' : 'Create account'}
              </button>
            </div>
          </motion.div>

          <div className="mt-5 grid gap-3 text-[13px] text-[var(--text-2)] sm:grid-cols-3">
            <div className="rounded-[var(--radius-md)] border border-[var(--border-md)] bg-[var(--bg-card-2)] px-4 py-3">
              Quick Add
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border-md)] bg-[var(--bg-card-2)] px-4 py-3">
              Receipt attach
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border-md)] bg-[var(--bg-card-2)] px-4 py-3">
              Offline cache
            </div>
          </div>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#1A2744_0%,#0F1117_70%)] px-8 py-8 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-5rem] top-[-4rem] h-80 w-80 rounded-full bg-[var(--accent)] opacity-20 blur-[90px]" />
          <div className="absolute right-[-6rem] top-1/3 h-96 w-96 rounded-full bg-[var(--blue)] opacity-15 blur-[90px]" />
          <div className="absolute bottom-[-6rem] left-1/3 h-80 w-80 rounded-full bg-[var(--green)] opacity-12 blur-[90px]" />
        </div>

        <div className="relative z-10 flex w-full flex-col justify-between gap-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">Why it feels different</p>
            <h2 className="mt-4 text-[42px] font-bold tracking-[-0.04em] text-white">
              Your complete finance companion.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/65">
              Track income and expenses, see savings auto-calculated, attach receipts, manage budgets across currencies, and use quick shortcuts from one mobile-friendly workspace.
            </p>

            <div className="mt-10 grid gap-4">
              {showcaseCards.map((card) => (
                <motion.article
                  key={card.title}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                  className="rounded-[24px] border border-white/10 bg-white/[0.08] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                      <card.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{card.title}</p>
                      <p className="mt-1 text-sm leading-6 text-white/68">{card.body}</p>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>

          <motion.div
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            className="max-w-2xl rounded-[28px] border border-white/10 bg-white/[0.08] p-6 shadow-[0_18px_44px_rgba(0,0,0,0.2)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">Offline-first workspace</p>
                <p className="mt-3 text-xl font-semibold text-white">Your data syncs, your devices stay fast.</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_10px_26px_var(--accent-glow)]">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/70">
              Synced through the cloud so the same account works everywhere, with local caching so your categories, budgets, receipts, and savings still load instantly when you reopen the app.
            </p>
          </motion.div>
        </div>
      </aside>
    </main>
  );
}

export function SetupWorkspace({ onSubmit, isSubmitting = false }: SetupWorkspaceProps) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<UserPreferences['currency']>('USD');

  return (
    <main className="min-h-screen bg-[var(--bg)] lg:grid lg:grid-cols-[minmax(0,48fr)_minmax(0,52fr)]">
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--bg)] px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute left-[-6rem] top-[-4rem] h-72 w-72 rounded-full bg-[var(--accent-soft)] blur-3xl" />
          <div className="absolute bottom-[-5rem] right-[-3rem] h-80 w-80 rounded-full bg-[var(--green-soft)] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-[0_10px_26px_var(--accent-glow)]">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--text-1)]">Expense Tracker</p>
              <p className="text-xs text-[var(--text-2)]">Finish setting up your synced workspace</p>
            </div>
          </div>

          <div className="mt-10 max-w-lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-2)]">First launch</p>
            <h1 className="mt-4 text-[34px] font-bold tracking-[-0.03em] text-[var(--text-1)] sm:text-[40px]">
              Personalize your account.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--text-2)] sm:text-base">
              Add your name and default currency once, then the same workspace syncs across every device you sign into.
            </p>
          </div>

          <motion.form
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              void onSubmit?.({ name: name.trim(), currency });
            }}
            className="mt-8 w-full max-w-xl rounded-[24px] border border-[var(--border-md)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow)] sm:p-6"
          >
            <div className="space-y-4">
              <AuthInput
                label="Your name"
                icon={User}
                value={name}
                onChange={setName}
                placeholder="How should we address you?"
                autoComplete="name"
              />

              <label className="block space-y-2">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-2)]">Default currency</span>
                <CustomSelect value={currency} onChange={(value) => setCurrency(value as UserPreferences['currency'])} options={setupCurrencyOptions} className="w-full" />
              </label>

              <motion.button
                whileTap={{ scale: 0.96 }}
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="ui-btn ui-btn-primary h-14 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Setting up…' : 'Get Started'}
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.form>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#1A2744_0%,#0F1117_70%)] px-8 py-8 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_40px,rgba(255,255,255,0.012)_40px,rgba(255,255,255,0.012)_80px)]" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-5rem] top-[-4rem] h-80 w-80 rounded-full bg-[var(--accent)] opacity-18 blur-[90px]" />
          <div className="absolute right-[-6rem] top-1/3 h-96 w-96 rounded-full bg-[var(--green)] opacity-10 blur-[90px]" />
        </div>
        <div className="relative z-10 flex w-full flex-col justify-between gap-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">Why synced caching works</p>
            <h2 className="mt-4 text-[42px] font-bold tracking-[-0.04em] text-white">
              Fast, private, and designed for daily use.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/65">
              Your source of truth lives in the cloud, each device keeps an offline cache, and the experience still feels as fast as a focused mobile finance product.
            </p>
          </div>

          <div className="grid gap-4">
            {showcaseCards.map((card) => (
              <motion.article
                key={card.title}
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="rounded-[24px] border border-white/10 bg-white/[0.08] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{card.title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/68">{card.body}</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}

export function Splash({ onStart, onPreviewWorkspace }: SplashProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const touchStartRef = useRef<number | null>(null);
  const hasCompletedOnboarding = useMemo(() => localStorage.getItem(onboardingKey) === 'true', []);

  const advance = () => {
    if (activeSlide === onboardingSlides.length - 1) {
      localStorage.setItem(onboardingKey, 'true');
      onStart?.();
      return;
    }

    setActiveSlide((current) => current + 1);
  };

  const goBack = () => {
    setActiveSlide((current) => Math.max(0, current - 1));
  };

  const active = onboardingSlides[activeSlide];
  const ActiveIcon = active.icon;

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #1A2744 0%, #0F1117 70%)' }}
    >
      <div className="absolute -left-16 top-0 h-72 w-72 rounded-full blur-[80px]" style={{ backgroundColor: 'var(--accent)', opacity: 0.15 }} />
      <div className="absolute right-[-3rem] top-1/3 h-80 w-80 rounded-full blur-[80px]" style={{ backgroundColor: 'var(--green)', opacity: 0.15 }} />
      <div className="absolute bottom-[-4rem] left-1/4 h-72 w-72 rounded-full blur-[80px]" style={{ backgroundColor: 'var(--blue)', opacity: 0.15 }} />

      <AnimatePresence mode="wait">
        {!showOnboarding ? (
          <motion.section
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="splash-screen mx-auto flex min-h-screen w-full flex-col items-center justify-center px-6 pb-12 pt-10 text-center"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Wallet className="h-7 w-7 text-white" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.32 }}
              className="mt-6 text-[32px] font-bold tracking-[-0.02em] text-white"
            >
              Expense Tracker
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.32 }}
              className="mt-3 text-base text-white/55"
            >
              Track income, expenses & savings. Synced and mobile-first.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.36 }}
              className="mt-12 w-full"
            >
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => {
                  if (hasCompletedOnboarding) {
                    onStart?.();
                    return;
                  }
                  setShowOnboarding(true);
                }}
                className="splash-cta ui-btn ui-btn-primary h-14 w-full text-base"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Get Started
              </motion.button>

              <button
                type="button"
                onClick={onPreviewWorkspace}
                className="mt-5 text-sm font-medium text-white/75 transition-colors hover:text-white"
              >
                Already have an account? Sign in
              </button>
            </motion.div>
          </motion.section>
        ) : (
          <motion.section
            key="onboarding"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            className="splash-screen mx-auto flex min-h-screen w-full flex-col px-6 pb-10 pt-8"
          >
            <div className="flex justify-end">
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => {
                  localStorage.setItem(onboardingKey, 'true');
                  onStart?.();
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/72"
              >
                <SkipForward className="h-4 w-4" />
                Skip
              </motion.button>
            </div>

            <div
              className="flex flex-1 flex-col items-center justify-center text-center"
              onTouchStart={(event) => {
                touchStartRef.current = event.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(event) => {
                if (touchStartRef.current === null) return;
                const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartRef.current;
                if (delta <= -40) advance();
                if (delta >= 40) goBack();
                touchStartRef.current = null;
              }}
            >
              <motion.div
                key={active.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="w-full"
              >
                <div className="mx-auto flex h-[200px] w-[200px] items-center justify-center rounded-full" style={{ backgroundColor: 'var(--accent-soft)' }}>
                  <ActiveIcon className="h-16 w-16" style={{ color: 'var(--accent)' }} />
                </div>
                <h2 className="mt-10 text-2xl font-bold tracking-[-0.02em] text-white">{active.title}</h2>
                <p className="mx-auto mt-4 max-w-sm text-[15px] leading-7 text-[var(--text-2)]">{active.subtitle}</p>
              </motion.div>
            </div>

            <div className="flex items-center justify-center gap-2">
              {onboardingSlides.map((slide, index) => (
                <button
                  key={slide.key}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  onClick={() => setActiveSlide(index)}
                  className="h-2.5 rounded-full transition-all"
                  style={{
                    width: index === activeSlide ? 22 : 8,
                    backgroundColor: index === activeSlide ? 'var(--accent)' : 'rgba(255,255,255,0.22)',
                  }}
                />
              ))}
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={advance}
              className="splash-cta ui-btn ui-btn-primary mt-8 h-14 w-full text-base"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {activeSlide === onboardingSlides.length - 1 ? "Let's go" : 'Next'}
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

export function SignIn(props: AuthScreenProps = {}) {
  return <AuthForm {...props} mode="signin" />;
}

export function SignUp(props: AuthScreenProps = {}) {
  return <AuthForm {...props} mode="signup" />;
}

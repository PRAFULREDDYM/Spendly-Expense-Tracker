import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChartColumn, PieChart as PieChartIcon, Target } from 'lucide-react';
import type { Budget, Category, ExpenseFilterType, ReportSummary } from '../types';
import {
  DateRangeValue,
  PageShell,
  prettyCurrency,
  monthRange,
} from '../components/shell';
import { buildDefaultRange } from '../components/shell';
import { DonutChart, GroupedBarChart, MiniBarChart, TrendAreaChart } from '../components/charts/SvgCharts';
import { apiClient } from '../api';
import { formatCategory } from '../components/ui/categoryIcons';
import { clampPercentage, getCategoryColor } from '../lib/ui';

export interface AnalysisViewProps {
  report?: ReportSummary;
  range?: DateRangeValue;
  isLoading?: boolean;
  headerAccessory?: React.ReactNode;
  categories?: Category[];
  budgets?: Budget[];
  onRangeChange?: (range: DateRangeValue) => void;
  onExportCsv?: () => void;
  isExportingCsv?: boolean;
}

const periodOptions = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
] as const;

function buildYearRange() {
  const now = new Date();
  return {
    preset: 'custom' as const,
    start: `${now.getFullYear()}-01-01`,
    end: `${now.getFullYear()}-12-31`,
  };
}

function getActivePeriod(range: DateRangeValue) {
  const week = buildDefaultRange();
  const month = monthRange();
  const year = buildYearRange();

  if (range.start === week.start && range.end === week.end) return 'weekly';
  if (range.start === month.start && range.end === month.end) return 'monthly';
  if (range.start === year.start && range.end === year.end) return 'yearly';
  return 'monthly';
}

function formatDateRangeLabel(range: DateRangeValue) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  return `${formatter.format(new Date(range.start))} - ${formatter.format(new Date(range.end))}`;
}

async function fetchReportSummary(range: DateRangeValue, type: ExpenseFilterType) {
  return apiClient.reports.summary({
    start: new Date(`${range.start}T00:00:00.000Z`).toISOString(),
    end: new Date(`${range.end}T23:59:59.999Z`).toISOString(),
  }, type);
}

function countDaysInRange(range: DateRangeValue) {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
}

function buildComparisonTrend(expenseReport?: ReportSummary | null, incomeReport?: ReportSummary | null) {
  const buckets = new Set<string>();
  for (const point of expenseReport?.trend ?? []) buckets.add(point.bucket);
  for (const point of incomeReport?.trend ?? []) buckets.add(point.bucket);

  const expenseMap = new Map((expenseReport?.trend ?? []).map((point) => [point.bucket, point.total]));
  const incomeMap = new Map((incomeReport?.trend ?? []).map((point) => [point.bucket, point.total]));

  return Array.from(buckets)
    .sort((left, right) => left.localeCompare(right))
    .map((bucket) => ({
      bucket,
      expense: expenseMap.get(bucket) ?? 0,
      income: incomeMap.get(bucket) ?? 0,
    }));
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

function AnalysisEmptyPanel({
  icon,
  title,
  description,
  tone = 'accent',
  className = '',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone?: 'accent' | 'purple' | 'amber';
  className?: string;
}) {
  const palette =
    tone === 'purple'
      ? { background: 'var(--purple-soft)', color: 'var(--accent)' }
      : tone === 'amber'
        ? { background: 'var(--amber-soft)', color: 'var(--amber)' }
        : { background: 'var(--accent-soft)', color: 'var(--accent)' };

  return (
    <div className={`flex h-full min-h-[180px] flex-col items-center justify-center rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low px-6 py-10 text-center sm:min-h-[220px] ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: palette.background, color: palette.color }}>
        {icon}
      </div>
      <h3 className="mt-5 text-base font-semibold text-on-surface">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-on-surface-variant">{description}</p>
    </div>
  );
}

export default function AnalysisView({
  report,
  range: controlledRange,
  isLoading = false,
  headerAccessory,
  categories = [],
  budgets = [],
  onRangeChange,
  onExportCsv,
  isExportingCsv = false,
}: AnalysisViewProps = {}) {
  const range = controlledRange ?? monthRange();
  const activePeriod = getActivePeriod(range);
  const [activeMode, setActiveMode] = useState<'expense' | 'income'>('expense');
  const [activeSlice, setActiveSlice] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState(false);
  const [incomeReport, setIncomeReport] = useState<ReportSummary | null>(null);
  const [incomeLoading, setIncomeLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIncomeLoading(true);
    void fetchReportSummary(range, 'income')
      .then((nextReport) => {
        if (!cancelled) {
          setIncomeReport(nextReport);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIncomeReport(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIncomeLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [range.end, range.start]);

  const activeReport = activeMode === 'income' ? incomeReport : report;
  const activeTotal = activeReport?.totalSpent ?? 0;
  const rangeDays = countDaysInRange(range);

  const trendSeries = useMemo(
    () => {
      const points = (activeReport?.trend ?? []).map((point) => ({
        bucket: point.bucket,
        value: point.total,
      }));

      if (points.length === 1) {
        return [
          { bucket: 'Start', value: 0 },
          points[0],
        ];
      }

      return points;
    },
    [activeReport],
  );
  const trendChartData = useMemo(
    () => trendSeries.map((point) => ({ label: point.bucket, value: point.value })),
    [trendSeries],
  );

  const donutData = useMemo(
    () => (activeReport?.categoryBreakdown ?? []).map((entry) => ({
      ...entry,
      color: entry.color ?? getCategoryColor(entry.categoryName),
      percent: activeTotal ? (entry.total / activeTotal) * 100 : 0,
    })),
    [activeReport, activeTotal],
  );

  const activeDonutSlice = donutData.find((item) => item.categoryName === activeSlice) ?? donutData[0] ?? null;
  const categoryCards = (expandedCategories ? donutData : donutData.slice(0, 4)).map((entry) => ({
    ...entry,
    miniTrend: trendSeries.slice(-5).map((point, index) => ({
      bucket: point.bucket,
      total: point.value * ((entry.percent / 100) * (0.7 + index * 0.06)),
    })),
  }));

  const accountActivity = useMemo(
    () => buildComparisonTrend(report, incomeReport).map((point) => ({
      label: point.bucket,
      income: point.income,
      expense: point.expense,
    })),
    [incomeReport, report],
  );

  const incomeSummary = useMemo(() => ({
    total: incomeReport?.totalSpent ?? 0,
    average: (incomeReport?.totalSpent ?? 0) / rangeDays,
    sources: incomeReport?.categoryBreakdown.length ?? 0,
  }), [incomeReport, rangeDays]);

  return (
    <PageShell
      title="Analysis"
      subtitle="Track trends, category split, and goal progress from the same reporting window."
      headerAccessory={headerAccessory}
    >
      <div className="analysis-controls flex flex-wrap items-center gap-3">
        <div className="horizontal-scroll flex gap-1 overflow-x-auto hide-scrollbar">
          {periodOptions.map((option) => {
            const active = option.key === activePeriod;
            return (
              <motion.button
                key={option.key}
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() =>
                  onRangeChange?.(
                    option.key === 'weekly'
                      ? buildDefaultRange()
                      : option.key === 'monthly'
                        ? monthRange()
                        : buildYearRange(),
                  )
                }
                className="pill-filter shrink-0"
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
        <p className="text-sm text-on-surface-variant">{formatDateRangeLabel(range)}</p>
      </div>

      <section className="surface-card overflow-hidden rounded-[var(--radius-md)] p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-on-surface">{activeMode === 'income' ? 'Income trend' : 'Trend'}</p>
            <p className="mt-1 text-sm text-on-surface-variant">Smooth view of changes across the active range.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex rounded-full bg-surface-container p-1">
              {(['expense', 'income'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setActiveMode(mode)}
                  className="relative z-10 rounded-full px-4 py-2 text-sm font-medium"
                  style={{ color: activeMode === mode ? '#fff' : 'var(--text-2)' }}
                >
                  {activeMode === mode && (
                    <motion.span
                      layoutId="analysis-mode-pill"
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundColor: mode === 'expense' ? 'var(--accent)' : 'var(--green)' }}
                    />
                  )}
                  <span className="relative z-10">{mode === 'expense' ? 'Expense' : 'Income'}</span>
                </button>
              ))}
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onExportCsv}
              className="ui-btn ui-btn-primary h-11"
            >
              {isExportingCsv ? 'Exporting...' : 'Export CSV'}
            </motion.button>
          </div>
        </div>

        {activeMode === 'income' && (
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {[
              { label: 'Total income', value: prettyCurrency(incomeSummary.total), color: 'var(--green)' },
              { label: 'Avg per day', value: prettyCurrency(incomeSummary.average), color: 'var(--text-1)' },
              { label: 'Sources', value: String(incomeSummary.sources), color: 'var(--text-1)' },
            ].map((item) => (
              <div key={item.label} className="rounded-[var(--radius-md)] bg-[var(--bg-card-2)] p-[14px]">
                <p className="text-[11px] text-on-surface-variant">{item.label}</p>
                <p className="mt-1 text-base font-semibold" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="trend-chart-container h-[220px]">
          {isLoading || (activeMode === 'income' && incomeLoading) ? (
            <div className="h-full animate-pulse rounded-[var(--radius-md)] bg-surface-container" />
          ) : trendSeries.length ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeMode}-${range.start}-${range.end}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <TrendAreaChart
                  data={trendChartData}
                  color={activeMode === 'expense' ? 'var(--accent)' : 'var(--green)'}
                  axisLabelColor="var(--text-3)"
                  gridColor="var(--border)"
                  className="h-full"
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <AnalysisEmptyPanel
              icon={<ChartColumn className="h-5 w-5" />}
              title={activeMode === 'income' ? 'No income data yet' : 'No spending data yet'}
              description={activeMode === 'income' ? 'Save income in the selected range to populate the analysis view.' : 'Save expenses in the selected range to populate the analysis view.'}
              className="min-h-full"
            />
          )}
        </div>
      </section>

      <section className="category-breakdown-grid grid gap-4 md:grid-cols-2">
        {categoryCards.length ? (
          <>
            {categoryCards.map((entry) => (
              <motion.article
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                key={entry.categoryName}
                className="surface-card rounded-[var(--radius-md)] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <p className="text-sm font-semibold text-on-surface">{formatCategory(entry.categoryName)}</p>
                    </div>
                    <p className="mt-2 text-lg font-bold tracking-[-0.03em] text-on-surface">{prettyCurrency(entry.total, entry.currency)}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{entry.percent.toFixed(1)}% of total</p>
                  </div>
                  <div className="h-20 w-28">
                    <MiniBarChart
                      data={entry.miniTrend.map((point) => ({
                        label: point.bucket,
                        value: point.total,
                        color: entry.color,
                      }))}
                      className="h-full"
                    />
                  </div>
                </div>
              </motion.article>
            ))}
            {donutData.length > 4 && (
              <button
                type="button"
                onClick={() => setExpandedCategories((current) => !current)}
                className="md:col-span-2 text-sm font-medium text-primary"
              >
                {expandedCategories ? 'Show less' : 'See all'}
              </button>
            )}
          </>
        ) : (
          <div className="md:col-span-2">
            <AnalysisEmptyPanel
              icon={<PieChartIcon className="h-5 w-5" />}
              title={activeMode === 'income' ? 'No sources to show' : 'No categories to show'}
              description={activeMode === 'income' ? 'Income sources will appear once report data is available.' : 'Category totals will appear once report data is available.'}
              tone="purple"
            />
          </div>
        )}
      </section>

      <div className="analysis-two-col analysis-grid grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="surface-card overflow-hidden rounded-[var(--radius-md)] p-4">
          <div className="mb-4">
            <p className="text-base font-semibold text-on-surface">{activeMode === 'income' ? 'Source split' : 'Category split'}</p>
            <p className="mt-1 text-sm text-on-surface-variant">Tap a slice to inspect the category in more detail.</p>
          </div>

          {donutData.length ? (
            <>
              <div className="donut-chart-container mx-auto h-[260px] max-w-[320px]">
                <DonutChart
                  data={donutData.map((entry) => ({
                    label: entry.categoryName,
                    value: entry.total,
                    color: entry.color,
                  }))}
                  activeLabel={activeSlice}
                  onSelect={setActiveSlice}
                  className="h-full"
                  centerContent={
                    <div className="flex flex-col items-center justify-center text-center">
                      <p className="text-[20px] font-bold tracking-[-0.03em] text-on-surface">{prettyCurrency(activeTotal)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-on-surface-variant">Total</p>
                    </div>
                  }
                />
              </div>

              {activeDonutSlice && (
                <div className="mt-4 rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: activeDonutSlice.color }} />
                    <p className="text-sm font-semibold text-on-surface">{formatCategory(activeDonutSlice.categoryName)}</p>
                  </div>
                  <p className="mt-3 text-lg font-bold tracking-[-0.03em] text-on-surface">
                    {prettyCurrency(activeDonutSlice.total, activeDonutSlice.currency)}
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">{activeDonutSlice.percent.toFixed(1)}% of total {activeMode === 'income' ? 'income' : 'spend'}</p>
                </div>
              )}

              <div className="mt-6 space-y-3">
                {donutData.map((entry) => (
                  <button
                    key={entry.categoryName}
                    type="button"
                    onClick={() => setActiveSlice(entry.categoryName)}
                    className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-outline/10 bg-surface-container-low px-3 py-3 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <p className="truncate text-sm font-medium text-on-surface">{formatCategory(entry.categoryName)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-on-surface">{prettyCurrency(entry.total, entry.currency)}</p>
                      <p className="text-xs text-on-surface-variant">{entry.percent.toFixed(1)}%</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4">
              <AnalysisEmptyPanel
                icon={<PieChartIcon className="h-5 w-5" />}
                title={activeMode === 'income' ? 'No sources to show' : 'No categories to show'}
                description={activeMode === 'income' ? 'Income sources will appear once report data is available.' : 'Category totals will appear once report data is available.'}
                tone="purple"
              />
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="surface-card overflow-hidden rounded-[var(--radius-md)] p-4">
            <div className="mb-4">
              <p className="text-base font-semibold text-on-surface">Account activity</p>
              <p className="mt-1 text-sm text-on-surface-variant">Income and expenses side by side.</p>
            </div>
            {accountActivity.length ? (
              <div className="activity-chart-container h-[180px]">
                <GroupedBarChart
                  data={accountActivity}
                  incomeColor="var(--green)"
                  expenseColor="var(--red)"
                  axisLabelColor="var(--text-3)"
                  gridColor="var(--border)"
                  className="h-full"
                />
              </div>
            ) : (
              <AnalysisEmptyPanel
                icon={<ChartColumn className="h-5 w-5" />}
                title="No activity to compare yet"
                description="Income and expense bars will appear once activity exists in the selected range."
              />
            )}
          </section>

          <section className="surface-card overflow-hidden rounded-[var(--radius-md)] p-4">
            <div className="mb-4">
              <p className="text-base font-semibold text-on-surface">Budget progress</p>
              <p className="mt-1 text-sm text-on-surface-variant">Budget progress across your current targets.</p>
            </div>
            {budgets.length ? (
              <div className="space-y-3">
                {budgets.map((budget) => {
                  const category = categories.find((item) => item.id === budget.categoryId);
                  const rawName = category?.name ?? 'Overall goal';
                  const name = category ? formatCategory(category.name) : rawName;
                  const color = getCategoryColor(rawName);
                  const progress = Math.min(100, (budget.spent / Math.max(budget.amount, 1)) * 100);
                  const tone = progress >= 80 ? 'var(--green)' : progress >= 50 ? 'var(--amber)' : 'var(--red)';
                  return (
                    <motion.article
                      whileHover={{ y: -2 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                      key={budget.id}
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
                    </motion.article>
                  );
                })}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={onExportCsv}
                  className="flex h-14 w-full items-center justify-center rounded-[var(--radius-md)] border border-dashed border-outline/25 bg-surface-container-low text-sm font-semibold text-primary"
                >
                  Add goal
                </motion.button>
              </div>
            ) : (
              <div className="space-y-3">
                <AnalysisEmptyPanel
                  icon={<Target className="h-5 w-5" />}
                  title="No budgets set"
                  description="Create budgets to visualize progress here."
                  tone="amber"
                />
                <div className="text-center">
                  <a href="/profile" className="inline-link text-sm font-semibold text-primary">
                    Open budget section
                  </a>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}

import React, { useId, useMemo } from 'react';

type TrendPoint = {
  label: string;
  value: number;
};

type BarPoint = {
  label: string;
  value: number;
  color: string;
  inactive?: boolean;
};

type GroupedPoint = {
  label: string;
  income: number;
  expense: number;
};

type DonutPoint = {
  label: string;
  value: number;
  color: string;
  inactive?: boolean;
};

export interface TrendAreaChartProps {
  data: TrendPoint[];
  color: string;
  emptyLabel?: string;
  className?: string;
  axisLabelColor?: string;
  gridColor?: string;
  showAxisLabels?: boolean;
}

export interface MiniBarChartProps {
  data: BarPoint[];
  className?: string;
  gridColor?: string;
}

export interface GroupedBarChartProps {
  data: GroupedPoint[];
  incomeColor?: string;
  expenseColor?: string;
  className?: string;
  axisLabelColor?: string;
  gridColor?: string;
}

export interface DonutChartProps {
  data: DonutPoint[];
  activeLabel?: string | null;
  onSelect?: (label: string) => void;
  centerContent?: React.ReactNode;
  className?: string;
  emptyLabel?: string;
}

const VIEWBOX_WIDTH = 1000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatAxisLabel(label: string) {
  if (!label) return '';
  if (label.length <= 8) return label;
  return label.slice(0, 8);
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx: number, cy: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function buildLinePoints(data: TrendPoint[], width: number, height: number, paddingX: number, paddingY: number) {
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const points = data.map((point, index) => {
    const x = data.length === 1 ? width / 2 : paddingX + (index / (data.length - 1)) * plotWidth;
    const y = paddingY + (1 - clamp(point.value / maxValue, 0, 1)) * plotHeight;
    return { ...point, x, y };
  });

  return { points, maxValue, plotWidth, plotHeight };
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const { x, y } = points[0];
    return `M ${x} ${y}`;
  }

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baselineY: number) {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const { x, y } = points[0];
    return `M ${x} ${baselineY} L ${x} ${y} L ${x} ${baselineY} Z`;
  }

  const linePath = buildLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

export function TrendAreaChart({
  data,
  color,
  emptyLabel = 'No data',
  className,
  axisLabelColor = 'var(--text-3)',
  gridColor = 'var(--border)',
  showAxisLabels = true,
}: TrendAreaChartProps) {
  const gradientId = useId();
  const chartHeight = 240;
  const paddingX = 24;
  const paddingTop = 20;
  const paddingBottom = 42;

  const { points, plotHeight } = useMemo(
    () => buildLinePoints(data, VIEWBOX_WIDTH, chartHeight, paddingX, paddingTop),
    [chartHeight, data],
  );

  const baselineY = chartHeight - paddingBottom;
  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(points, baselineY);
  const yTicks = [0.25, 0.5, 0.75];

  if (!data.length) {
    return (
      <div className={className}>
        <div className="flex h-full items-center justify-center rounded-[var(--radius-md)] border border-dashed border-outline/10 bg-surface-container-low px-4 text-sm text-on-surface-variant">
          {emptyLabel}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${chartHeight}`} preserveAspectRatio="none" className="block h-full w-full">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = paddingTop + plotHeight * tick;
          return (
            <line
              key={tick}
              x1={paddingX}
              x2={VIEWBOX_WIDTH - paddingX}
              y1={y}
              y2={y}
              stroke={gridColor}
              strokeWidth="1"
              strokeDasharray="4 10"
            />
          );
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((point, index) => {
          const isLast = index === points.length - 1;
          const isFirst = index === 0;
          const isMiddle = index === Math.floor(points.length / 2);
          const showLabel = isFirst || isMiddle || isLast || points.length <= 3;
          return (
            <g key={`${point.label}-${index}`}>
              <circle cx={point.x} cy={point.y} r={isLast ? 8 : 5} fill={isLast ? color : 'var(--bg-card)'} stroke={color} strokeWidth={2} />
              {showAxisLabels && showLabel && (
                <text
                  x={point.x}
                  y={chartHeight - 16}
                  textAnchor="middle"
                  fill={axisLabelColor}
                  fontSize="12"
                  fontWeight="500"
                >
                  {formatAxisLabel(point.label)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function MiniBarChart({ data, className, gridColor = 'var(--border)' }: MiniBarChartProps) {
  const chartHeight = 120;
  const paddingX = 8;
  const paddingTop = 10;
  const paddingBottom = 18;

  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const plotWidth = VIEWBOX_WIDTH - paddingX * 2;
  const gap = data.length > 6 ? 14 : 20;
  const barWidth = data.length ? (plotWidth - gap * (data.length - 1)) / data.length : 0;

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${chartHeight}`} preserveAspectRatio="none" className="block h-full w-full">
        {[0.33, 0.66].map((tick) => {
          const y = paddingTop + plotHeight * tick;
          return <line key={tick} x1={paddingX} x2={VIEWBOX_WIDTH - paddingX} y1={y} y2={y} stroke={gridColor} strokeWidth="1" strokeDasharray="4 10" />;
        })}

        {data.map((point, index) => {
          const groupX = paddingX + index * (barWidth + gap);
          const height = clamp((point.value / maxValue) * plotHeight, 4, plotHeight);
          const y = chartHeight - paddingBottom - height;
          return (
            <g key={`${point.label}-${index}`}>
              <rect
                x={groupX}
                y={y}
                width={barWidth}
                height={height}
                rx="10"
                fill={point.color}
                opacity={point.inactive ? 0.34 : 1}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function GroupedBarChart({
  data,
  incomeColor = 'var(--green)',
  expenseColor = 'var(--red)',
  className,
  axisLabelColor = 'var(--text-3)',
  gridColor = 'var(--border)',
}: GroupedBarChartProps) {
  const chartHeight = 180;
  const paddingX = 16;
  const paddingTop = 18;
  const paddingBottom = 34;
  const maxValue = Math.max(...data.flatMap((point) => [point.income, point.expense]), 1);
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const plotWidth = VIEWBOX_WIDTH - paddingX * 2;
  const groupWidth = data.length ? plotWidth / data.length : plotWidth;
  const barGap = 12;
  const barWidth = Math.max(10, (groupWidth - barGap * 3) / 2);

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${chartHeight}`} preserveAspectRatio="none" className="block h-full w-full">
        {[0.25, 0.5, 0.75].map((tick) => {
          const y = paddingTop + plotHeight * tick;
          return <line key={tick} x1={paddingX} x2={VIEWBOX_WIDTH - paddingX} y1={y} y2={y} stroke={gridColor} strokeWidth="1" strokeDasharray="4 10" />;
        })}

        {data.map((point, index) => {
          const baseX = paddingX + index * groupWidth + groupWidth / 2;
          const incomeHeight = clamp((point.income / maxValue) * plotHeight, 2, plotHeight);
          const expenseHeight = clamp((point.expense / maxValue) * plotHeight, 2, plotHeight);
          const incomeY = chartHeight - paddingBottom - incomeHeight;
          const expenseY = chartHeight - paddingBottom - expenseHeight;

          return (
            <g key={`${point.label}-${index}`}>
              <rect x={baseX - barWidth - barGap / 2} y={incomeY} width={barWidth} height={incomeHeight} rx="10" fill={incomeColor} />
              <rect x={baseX + barGap / 2} y={expenseY} width={barWidth} height={expenseHeight} rx="10" fill={expenseColor} />
              <text x={baseX} y={chartHeight - 10} textAnchor="middle" fill={axisLabelColor} fontSize="12" fontWeight="500">
                {formatAxisLabel(point.label)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DonutChart({
  data,
  activeLabel = null,
  onSelect,
  centerContent,
  className,
  emptyLabel = 'No data',
}: DonutChartProps) {
  const chartHeight = 260;
  const cx = 500;
  const cy = 130;
  const innerRadius = 62;
  const outerRadius = 96;
  const total = data.reduce((sum, point) => sum + point.value, 0);

  type DonutSegment = DonutPoint & { startAngle: number; endAngle: number };

  const segments = useMemo<DonutSegment[]>(() => {
    if (!total) return [];
    let startAngle = 0;

    return data.map((point) => {
      const share = point.value / total;
      const sweep = Math.max(0.25, share * 360);
      const segment = {
        ...point,
        startAngle,
        endAngle: startAngle + sweep,
      };
      startAngle += sweep;
      return segment;
    });
  }, [data, total]);

  if (!data.length) {
    return (
      <div className={className}>
        <div className="flex h-full items-center justify-center rounded-[var(--radius-md)] border border-dashed border-outline/10 bg-surface-container-low px-4 text-sm text-on-surface-variant">
          {emptyLabel}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative h-full w-full">
        <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" className="block h-full w-full">
          {segments.map((segment) => {
            const isActive = !activeLabel || activeLabel === segment.label;
            const path = describeArc(cx, cy, innerRadius, outerRadius, segment.startAngle - 90, segment.endAngle - 90);
            return (
              <path
                key={segment.label}
                d={path}
                fill={segment.color}
                opacity={isActive ? 1 : 0.28}
                onClick={() => onSelect?.(segment.label)}
                role={onSelect ? 'button' : undefined}
                tabIndex={onSelect ? 0 : -1}
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
              />
            );
          })}
        </svg>
        {centerContent ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {centerContent}
          </div>
        ) : null}
      </div>
    </div>
  );
}

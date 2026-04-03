import type { DateRange } from '../../types';
import { getPresetDateRange, type DateRangePreset } from '../shared/dateRange';

export interface ReportPresetOption {
  key: DateRangePreset;
  label: string;
  description: string;
}

export const REPORT_PRESET_OPTIONS: ReportPresetOption[] = [
  { key: 'thisWeek', label: 'This week', description: 'From Monday to today' },
  { key: 'last7Days', label: 'Last 7 days', description: 'Rolling seven day window' },
  { key: 'thisMonth', label: 'This month', description: 'Month to date' },
  { key: 'last30Days', label: 'Last 30 days', description: 'Rolling 30 day window' },
  { key: 'custom', label: 'Custom', description: 'Pick your own range' },
];

export function buildReportRange(preset: DateRangePreset, now: Date = new Date()): DateRange {
  return getPresetDateRange(preset, now);
}

export function getReportPresetLabel(preset: DateRangePreset) {
  return REPORT_PRESET_OPTIONS.find((option) => option.key === preset)?.label ?? preset;
}

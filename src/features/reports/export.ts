import type { CurrencyCode, ReportSummary } from '../../types';
import { buildCsv, triggerCsvDownload } from '../shared/csv';
import { DEFAULT_CURRENCY, formatMoney } from '../shared/money';

export function buildReportCsv(report: ReportSummary, currency: CurrencyCode = DEFAULT_CURRENCY) {
  return buildCsv(report.categoryBreakdown, [
    { key: 'categoryName', header: 'Category' },
    { key: 'total', header: 'Total', formatter: (value, row) => formatMoney(Number(value), row.currency ?? currency) },
    { key: 'currency', header: 'Currency' },
    { key: 'icon', header: 'Icon', formatter: (value) => String(value ?? '') },
    { key: 'color', header: 'Color', formatter: (value) => String(value ?? '') },
  ]);
}

export function exportReportCsv(report: ReportSummary, fileName = 'report.csv', currency: CurrencyCode = DEFAULT_CURRENCY) {
  return triggerCsvDownload(fileName, buildReportCsv(report, currency));
}

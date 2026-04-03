import type { DateRange } from '../types';

export function triggerDownload(blob: Blob, filename: string) {
  if (typeof document === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildCsvFilename(range?: DateRange) {
  if (!range?.start || !range?.end) {
    return 'expenses-export.csv';
  }

  return `expenses-${range.start}-to-${range.end}.csv`;
}

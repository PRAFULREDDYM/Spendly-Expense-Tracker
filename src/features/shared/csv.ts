export interface CsvColumn<T> {
  key: keyof T | string;
  header: string;
  formatter?: (value: unknown, row: T) => string | number | boolean | null | undefined;
}

export function escapeCsvValue(value: unknown) {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function buildCsv<T>(rows: T[], columns: Array<CsvColumn<T>>) {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(',');
  const body = rows.map((row) => columns
    .map((column) => {
      const rawValue = column.formatter ? column.formatter((row as Record<string, unknown>)[String(column.key)], row) : (row as Record<string, unknown>)[String(column.key)];
      return escapeCsvValue(rawValue);
    })
    .join(','));
  return [header, ...body].join('\n');
}

export function triggerCsvDownload(fileName: string, csvText: string) {
  if (typeof document === 'undefined') return false;
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

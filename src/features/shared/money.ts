import { supportedCurrencies, type CurrencyCode } from '../../types';

export const DEFAULT_CURRENCY: CurrencyCode = supportedCurrencies[0];

export interface CurrencyRateTable {
  baseCurrency: CurrencyCode;
  rates: Record<CurrencyCode, number>;
}

export function formatMoney(amount: number, currency: CurrencyCode, locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getCurrencySymbol(currency: CurrencyCode, locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(0)
    .replace(/[0-9\s.,]/g, '');
}

export function convertMoney(amount: number, from: CurrencyCode, to: CurrencyCode, table: CurrencyRateTable) {
  if (from === to) return amount;
  const fromRate = table.rates[from];
  const toRate = table.rates[to];
  if (!fromRate || !toRate) {
    return amount;
  }
  const inBase = amount / fromRate;
  return inBase * toRate;
}

export function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

import { APP_CONFIG } from '../config/appConfig';

const formatter = new Intl.NumberFormat(APP_CONFIG.locale, {
  style: 'currency',
  currency: APP_CONFIG.currency,
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat(APP_CONFIG.locale, {
  style: 'currency',
  currency: APP_CONFIG.currency,
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatILS(amount: number): string {
  return formatter.format(Math.round(amount));
}

export function formatILSCompact(amount: number): string {
  return compactFormatter.format(amount);
}

export function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

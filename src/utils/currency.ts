import { AppSettings } from '../types';

/**
 * Converts float / decimal number to integer paise/cents.
 * e.g. 150.25 -> 15025
 */
export function toPaise(amount: number | string): number {
  if (typeof amount === 'string') {
    const cleaned = amount.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  }
  return Math.round(amount * 100);
}

/**
 * Converts integer paise/cents to standard decimal number.
 * e.g. 15025 -> 150.25
 */
export function fromPaise(paise: number): number {
  return (paise || 0) / 100;
}

/**
 * Formats a number with Indian digit grouping:
 * e.g. 1234567.89 -> "12,34,567.89"
 */
export function formatIndianNumber(val: number): string {
  const parts = val.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  const isNegative = integerPart.startsWith('-');
  if (isNegative) {
    integerPart = integerPart.substring(1);
  }

  if (integerPart.length <= 3) {
    return (isNegative ? '-' : '') + integerPart + '.' + decimalPart;
  }

  // Last 3 digits
  const lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  const withCommas = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

  return (isNegative ? '-' : '') + withCommas + ',' + lastThree + '.' + decimalPart;
}

/**
 * Formats a number with Western standard grouping:
 * e.g. 1234567.89 -> "1,234,567.89"
 */
export function formatWesternNumber(val: number): string {
  const parts = val.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return integerPart + '.' + parts[1];
}

/**
 * Main currency formatter for paise amounts throughout the app.
 */
export function formatCurrency(
  paise: number,
  settings: Partial<AppSettings> = {}
): string {
  const symbol = settings.currencySymbol ?? '₹';
  const useIndian = settings.useIndianGrouping ?? (symbol === '₹');
  const amount = fromPaise(paise);

  const formattedNum = useIndian
    ? formatIndianNumber(amount)
    : formatWesternNumber(amount);

  return `${symbol}${formattedNum}`;
}

/**
 * Short abbreviated format for charts and compact cards (e.g. ₹1.2L, ₹45k)
 */
export function formatCompactCurrency(
  paise: number,
  symbol = '₹'
): string {
  const amount = fromPaise(paise);
  if (amount >= 10000000) {
    return `${symbol}${(amount / 10000000).toFixed(1)}Cr`;
  }
  if (amount >= 100000) {
    return `${symbol}${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `${symbol}${(amount / 1000).toFixed(1)}k`;
  }
  return `${symbol}${amount.toFixed(0)}`;
}


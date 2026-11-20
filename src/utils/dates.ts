import {
  format,
  parseISO,
  isToday,
  isYesterday,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears,
  isValid,
} from 'date-fns';

/**
 * Returns today's date formatted as YYYY-MM-DD for database storage.
 */
export function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Formats a date string (YYYY-MM-DD or ISO) according to the user's date format preference.
 */
export function formatDisplayDate(
  dateStr: string,
  preferredFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY' = 'DD/MM/YYYY'
): string {
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;

    switch (preferredFormat) {
      case 'DD/MM/YYYY':
        return format(d, 'dd/MM/yyyy');
      case 'MM/DD/YYYY':
        return format(d, 'MM/dd/yyyy');
      case 'YYYY-MM-DD':
        return format(d, 'yyyy-MM-dd');
      default:
        return format(d, 'dd/MM/yyyy');
    }
  } catch {
    return dateStr;
  }
}

/**
 * Formats day header in Ledger (matching the reference design: TODAY, YESTERDAY, or "SAT, 11 JUL")
 */
export function formatDayGroupHeader(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;

    if (isToday(d)) {
      return 'TODAY';
    }
    if (isYesterday(d)) {
      return 'YESTERDAY';
    }
    return format(d, 'EEE, d MMM').toUpperCase();
  } catch {
    return dateStr;
  }
}

/**
 * Formats month group title (e.g. "JULY 2026")
 */
export function formatMonthGroupHeader(yearMonth: string): string {
  try {
    // yearMonth is "YYYY-MM"
    const [year, month] = yearMonth.split('-');
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return format(d, 'MMMM yyyy').toUpperCase();
  } catch {
    return yearMonth;
  }
}

/**
 * Format relative month name (e.g. "July")
 */
export function getMonthShortName(yearMonth: string): string {
  try {
    const [year, month] = yearMonth.split('-');
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return format(d, 'MMM');
  } catch {
    return yearMonth;
  }
}

export type PeriodPreset =
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'last_year'
  | 'all_time';

/**
 * Returns date range strings { startDate, endDate } for preset periods.
 */
export function getDateRangeForPreset(
  preset: PeriodPreset | string
): { startDate?: string; endDate?: string; title: string } {
  const now = new Date();

  switch (preset) {
    case 'this_month': {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        title: format(now, 'MMMM yyyy'),
      };
    }
    case 'last_month': {
      const prev = subMonths(now, 1);
      const start = startOfMonth(prev);
      const end = endOfMonth(prev);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        title: format(prev, 'MMMM yyyy'),
      };
    }
    case 'last_3_months': {
      const prev = subMonths(now, 2);
      const start = startOfMonth(prev);
      const end = endOfMonth(now);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        title: 'Last 3 Months',
      };
    }
    case 'last_6_months': {
      const prev = subMonths(now, 5);
      const start = startOfMonth(prev);
      const end = endOfMonth(now);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        title: 'Last 6 Months',
      };
    }
    case 'this_year': {
      const start = startOfYear(now);
      const end = endOfYear(now);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        title: format(now, 'yyyy'),
      };
    }
    case 'last_year': {
      const prevYear = subYears(now, 1);
      const start = startOfYear(prevYear);
      const end = endOfYear(prevYear);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        title: format(prevYear, 'yyyy'),
      };
    }
    case 'all_time':
    default:
      return {
        startDate: undefined,
        endDate: undefined,
        title: 'All Time',
      };
  }
}


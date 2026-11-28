import { toInputDateFormat } from '../../lib/dateFormat';

export type FinanceRangeType = 'month' | 'financial_year' | 'last_3_months';

export interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

/**
 * Returns Indian Financial Year (1 April - 31 March) for reference date.
 * E.g., for Nov 2026: 2026-04-01 to 2027-03-31, label "FY 2026-27".
 * For March 2027: 2026-04-01 to 2027-03-31, label "FY 2026-27".
 * For 31 March 2026: 2025-04-01 to 2026-03-31, label "FY 2025-26".
 * For 1 April 2026: 2026-04-01 to 2027-03-31, label "FY 2026-27".
 */
export function getIndianFinancialYearRange(
  refDate: Date = new Date(),
  timeZone = 'Asia/Kolkata'
): DateRange {
  const dateStr = toInputDateFormat(refDate, timeZone);
  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10);

  let startYear = year;
  let endYear = year + 1;

  if (month < 4) {
    startYear = year - 1;
    endYear = year;
  }

  const shortEnd = String(endYear).slice(2);
  return {
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`,
    label: `FY ${startYear}-${shortEnd}`,
  };
}

/**
 * Returns rolling 3-month range: today minus 3 months to today.
 */
export function getLast3MonthsRange(
  refDate: Date = new Date(),
  timeZone = 'Asia/Kolkata'
): DateRange {
  const endDate = toInputDateFormat(refDate, timeZone);
  const [y, m, d] = endDate.split('-').map(Number);
  // Subtract 3 calendar months safely
  const targetDate = new Date(Date.UTC(y, m - 1 - 3, d));
  const startDate = toInputDateFormat(targetDate, timeZone);

  return {
    startDate,
    endDate,
    label: 'Last 3 months',
  };
}

/**
 * Checks whether a payment date (YYYY-MM-DD) falls within the selected finance filter.
 */
export function isPaymentInDateRange(
  paymentDateStr: string,
  rangeType: FinanceRangeType = 'month',
  selectedMonth?: string,
  refDate: Date = new Date(),
  timeZone = 'Asia/Kolkata'
): boolean {
  if (!paymentDateStr) return false;
  const pDate = paymentDateStr.slice(0, 10);

  if (rangeType === 'financial_year') {
    const fy = getIndianFinancialYearRange(refDate, timeZone);
    return pDate >= fy.startDate && pDate <= fy.endDate;
  }

  if (rangeType === 'last_3_months') {
    const l3m = getLast3MonthsRange(refDate, timeZone);
    return pDate >= l3m.startDate && pDate <= l3m.endDate;
  }

  // Default: month filter
  if (!selectedMonth) return true;
  return pDate.startsWith(selectedMonth);
}

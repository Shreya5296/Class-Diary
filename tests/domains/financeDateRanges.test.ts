import { describe, it, expect } from 'vitest';
import {
  getIndianFinancialYearRange,
  getLast3MonthsRange,
  isPaymentInDateRange,
} from '../../src/domains/finances/financeDateRanges';

describe('Fix L3: financeDateRanges', () => {
  it('correctly handles FY boundaries: 31 March belongs to previous FY, 1 April to next FY', () => {
    // 31 March 2026 -> FY 2025-26 (2025-04-01 to 2026-03-31)
    const march31 = new Date(Date.UTC(2026, 2, 31, 12, 0, 0));
    const fyMarch31 = getIndianFinancialYearRange(march31);
    expect(fyMarch31.startDate).toBe('2025-04-01');
    expect(fyMarch31.endDate).toBe('2026-03-31');
    expect(fyMarch31.label).toBe('FY 2025-26');

    // 1 April 2026 -> FY 2026-27 (2026-04-01 to 2027-03-31)
    const april1 = new Date(Date.UTC(2026, 3, 1, 12, 0, 0));
    const fyApril1 = getIndianFinancialYearRange(april1);
    expect(fyApril1.startDate).toBe('2026-04-01');
    expect(fyApril1.endDate).toBe('2027-03-31');
    expect(fyApril1.label).toBe('FY 2026-27');
  });

  it('correctly computes rolling 3-month window from reference date', () => {
    // 28 Nov 2026 -> 3 months back is 28 Aug 2026
    const nov28 = new Date(Date.UTC(2026, 10, 28, 12, 0, 0));
    const range = getLast3MonthsRange(nov28);
    expect(range.startDate).toBe('2026-08-28');
    expect(range.endDate).toBe('2026-11-28');
  });

  it('isPaymentInDateRange filters correctly for Month mode', () => {
    expect(isPaymentInDateRange('2026-10-15', 'month', '2026-10')).toBe(true);
    expect(isPaymentInDateRange('2026-09-30', 'month', '2026-10')).toBe(false);
  });

  it('isPaymentInDateRange filters correctly for Financial Year mode', () => {
    const nov28 = new Date(Date.UTC(2026, 10, 28, 12, 0, 0)); // FY 2026-27
    expect(isPaymentInDateRange('2026-04-01', 'financial_year', undefined, nov28)).toBe(true);
    expect(isPaymentInDateRange('2026-10-15', 'financial_year', undefined, nov28)).toBe(true);
    expect(isPaymentInDateRange('2027-03-31', 'financial_year', undefined, nov28)).toBe(true);
    expect(isPaymentInDateRange('2026-03-31', 'financial_year', undefined, nov28)).toBe(false);
    expect(isPaymentInDateRange('2027-04-01', 'financial_year', undefined, nov28)).toBe(false);
  });

  it('isPaymentInDateRange filters correctly for Last 3 Months mode', () => {
    const nov28 = new Date(Date.UTC(2026, 10, 28, 12, 0, 0)); // 2026-08-28 to 2026-11-28
    expect(isPaymentInDateRange('2026-10-01', 'last_3_months', undefined, nov28)).toBe(true);
    expect(isPaymentInDateRange('2026-08-28', 'last_3_months', undefined, nov28)).toBe(true);
    expect(isPaymentInDateRange('2026-08-27', 'last_3_months', undefined, nov28)).toBe(false);
    expect(isPaymentInDateRange('2026-11-29', 'last_3_months', undefined, nov28)).toBe(false);
  });
});

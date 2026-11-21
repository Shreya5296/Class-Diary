import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Payment } from '../../src/domains/payments/paymentTypes';
import {
  calculateMonthlyAndYearlyEarnings,
  isValidRecordedPayment,
  getPaymentInrAmount,
  getPaymentDateInTz,
} from '../../src/domains/finances/financialCalculations';
import { FinanceSummaryCards } from '../../src/domains/finances/FinanceSummaryCards';
import { TopBar } from '../../src/layout/TopBar';
import { ClassesPage } from '../../src/domains/classes/ClassesPage';
import { AuthProvider } from '../../src/auth/AuthProvider';

describe('Profile, Finances & Class Schedule Refinements Regression', () => {
  it('verifies avatar edit availability by location: TopBar is display-only, no edit button', () => {
    const html = renderToString(React.createElement(AuthProvider, null, React.createElement(TopBar, { activeSection: 'classes' })));
    expect(html).toContain('avatarCircle');
    expect(html).not.toContain('avatarEditBtn');
    expect(html).not.toContain('Edit profile picture');
  });

  it('verifies Class Schedule filter toolbar has no label and controls are right-aligned', () => {
    const html = renderToString(React.createElement(AuthProvider, null, React.createElement(ClassesPage)));
    expect(html).not.toContain('Filter by Student:');
    expect(html).toContain('filter-schedule-student');
    expect(html).toContain('+ Schedule Class');
    expect(html).toContain('justify-content:flex-end');
  });

  it('verifies Finance summary cards render 5 INR-only cards without foreign currencies or descriptions', () => {
    const payments: Payment[] = [
      { payment_id: 'p1', student_id: 's1', amount: 50000, currency: 'INR', payment_date: '2026-11-10', status: 'RECORDED' },
      { payment_id: 'p2', student_id: 's1', amount: 200, currency: 'USD', in_inr: 16500, payment_date: '2026-10-05', status: 'RECORDED' },
      { payment_id: 'p3', student_id: 's2', amount: 10000, currency: 'INR', payment_date: '2025-12-01', status: 'RECORDED' },
    ];
    const summary = { totalInvoiced: 150000, totalCollected: 66500, currency: 'INR' };
    const currencyTotals = { packagesByCurrency: {}, paymentsByCurrency: {}, totalRecordedInr: 66500 };

    const html = renderToString(React.createElement(FinanceSummaryCards, {
      summary, currencyTotals, payments, timeZone: 'Asia/Kolkata',
    }));

    // 5 card headers
    expect(html).toContain('Lifetime Package Value');
    expect(html).toContain('Lifetime Payments Received');
    expect(html).toContain('Recorded INR Value');
    expect(html).toContain('Monthly Earnings');
    expect(html).toContain('Yearly Earnings');

    // Values formatted in INR
    expect(html).toContain('₹1,50,000');
    expect(html).toContain('₹66,500');

    // Removed foreign currencies and descriptions
    expect(html).not.toContain('Total agreed value by package currency');
    expect(html).not.toContain('Total collected by payment currency');
    expect(html).not.toContain('Total Recorded INR Equivalent across all transactions');
    expect(html).not.toContain('£');
    expect(html).not.toContain('A$');
  });

  it('calculates monthly and yearly earnings using payment dates and recorded in_inr', () => {
    const refDate = new Date('2026-11-21T10:00:00Z');
    const payments: Payment[] = [
      // November 2026: INR 25,000
      { payment_id: 'p1', student_id: 's1', amount: 25000, currency: 'INR', payment_date: '2026-11-15', status: 'RECORDED' },
      // November 2026: USD with in_inr = 8,200
      { payment_id: 'p2', student_id: 's2', amount: 100, currency: 'USD', in_inr: 8200, payment_date: '2026-11-02', status: 'RECORDED' },
      // October 2026 (same year, different month): INR 30,000
      { payment_id: 'p3', student_id: 's3', amount: 30000, currency: 'INR', payment_date: '2026-10-18', status: 'RECORDED' },
      // 2025 (prior year): INR 50,000
      { payment_id: 'p4', student_id: 's4', amount: 50000, currency: 'INR', payment_date: '2025-11-15', status: 'RECORDED' },
    ];

    const result = calculateMonthlyAndYearlyEarnings(payments, 'Asia/Kolkata', refDate);
    // November 2026: 25,000 + 8,200 = 33,200
    expect(result.monthlyEarnings).toBe(33200);
    // Year 2026: 25,000 + 8,200 + 30,000 = 63,200
    expect(result.yearlyEarnings).toBe(63200);
  });

  it('excludes VOID, CANCELLED, and REVERSED payments from earnings', () => {
    const refDate = new Date('2026-11-21T10:00:00Z');
    const payments: Payment[] = [
      { payment_id: 'p1', student_id: 's1', amount: 10000, currency: 'INR', payment_date: '2026-11-05', status: 'RECORDED' },
      { payment_id: 'p2', student_id: 's2', amount: 20000, currency: 'INR', payment_date: '2026-11-06', status: 'VOID' },
      { payment_id: 'p3', student_id: 's3', amount: 15000, currency: 'INR', payment_date: '2026-11-07', payment_status: 'CANCELLED', status: 'RECORDED' },
      { payment_id: 'p4', student_id: 's4', amount: 12000, currency: 'INR', payment_date: '2026-11-08', status: 'REVERSED' },
    ];

    expect(isValidRecordedPayment(payments[0])).toBe(true);
    expect(isValidRecordedPayment(payments[1])).toBe(false);
    expect(isValidRecordedPayment(payments[2])).toBe(false);
    expect(isValidRecordedPayment(payments[3])).toBe(false);

    const result = calculateMonthlyAndYearlyEarnings(payments, 'Asia/Kolkata', refDate);
    expect(result.monthlyEarnings).toBe(10000);
    expect(result.yearlyEarnings).toBe(10000);
  });

  it('respects timezone boundaries when determining month and year transitions', () => {
    // 2026-10-31T20:00:00Z is 2026-11-01 01:30 in Asia/Kolkata (UTC+5:30)
    // but 2026-10-31 16:00 in America/New_York (UTC-4)
    const boundaryIso = '2026-10-31T20:00:00.000Z';
    const dateInKolkata = getPaymentDateInTz(boundaryIso, 'Asia/Kolkata');
    const dateInNewYork = getPaymentDateInTz(boundaryIso, 'America/New_York');

    expect(dateInKolkata).toBe('2026-11-01');
    expect(dateInNewYork).toBe('2026-10-31');

    const payment: Payment = {
      payment_id: 'p_tz', student_id: 's_tz', amount: 10000, currency: 'INR', payment_date: boundaryIso, status: 'RECORDED',
    };

    // Reference date: Nov 15, 2026
    const refDate = new Date('2026-11-15T12:00:00Z');
    const kolkataEarnings = calculateMonthlyAndYearlyEarnings([payment], 'Asia/Kolkata', refDate);
    const nyEarnings = calculateMonthlyAndYearlyEarnings([payment], 'America/New_York', refDate);

    // In Kolkata, payment is in November -> included in monthly earnings
    expect(kolkataEarnings.monthlyEarnings).toBe(10000);
    // In NY, payment is in October -> not in November monthly earnings
    expect(nyEarnings.monthlyEarnings).toBe(0);
  });
});

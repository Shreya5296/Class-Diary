import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  calculateStudentFinancialBalances,
  CurrencyFinancialBalance,
} from '../../src/domains/finances/studentFinancialAccounting';
import { StudentFinancialCardView } from '../../src/domains/students/StudentFinancialCardView';

describe('CONFIRMED ACCOUNTING RULE — Student Outstanding Money', () => {
  const studentId = 'STU_ACCOUNTING_TEST';

  describe('1. Multiple packages in the same currency', () => {
    it('sums total payable across all packages and calculates remaining balance', () => {
      const packages = [
        { student_id: studentId, package_price: 12000, currency: 'INR', status: 'COMPLETED' },
        { student_id: studentId, package_price: 15000, currency: 'INR', status: 'ACTIVE' },
      ];
      const payments = [
        { student_id: studentId, amount: 12000, currency: 'INR', status: 'PAID' },
        { student_id: studentId, amount: 10000, currency: 'INR', status: 'PAID' },
      ];

      const balances = calculateStudentFinancialBalances(packages, payments, studentId);
      expect(balances).toHaveLength(1);
      expect(balances[0].currency).toBe('INR');
      expect(balances[0].totalPayable).toBe(27000);
      expect(balances[0].totalPaid).toBe(22000);
      expect(balances[0].outstanding).toBe(5000);
      expect(balances[0].availableCredit).toBe(0);
      expect(balances[0].isReliable).toBe(true);
    });
  });

  describe('2. Multiple currencies isolated segregation', () => {
    it('calculates each currency in complete isolation without conversions or cross-deductions', () => {
      const packages = [
        { student_id: studentId, package_price: 25000, currency: 'INR' },
        { student_id: studentId, package_price: 300, currency: 'USD' },
        { student_id: studentId, package_price: 450, currency: 'AUD' },
      ];
      const payments = [
        { student_id: studentId, amount: 25000, currency: 'INR' }, // fully paid
        { student_id: studentId, amount: 200, currency: 'USD' },   // partial
        { student_id: studentId, amount: 500, currency: 'AUD' },   // overpaid
      ];

      const balances = calculateStudentFinancialBalances(packages, payments, studentId);
      expect(balances).toHaveLength(3);

      const aud = balances.find((b) => b.currency === 'AUD')!;
      expect(aud.totalPayable).toBe(450);
      expect(aud.totalPaid).toBe(500);
      expect(aud.outstanding).toBe(0);
      expect(aud.availableCredit).toBe(50);

      const inr = balances.find((b) => b.currency === 'INR')!;
      expect(inr.totalPayable).toBe(25000);
      expect(inr.totalPaid).toBe(25000);
      expect(inr.outstanding).toBe(0);
      expect(inr.availableCredit).toBe(0);

      const usd = balances.find((b) => b.currency === 'USD')!;
      expect(usd.totalPayable).toBe(300);
      expect(usd.totalPaid).toBe(200);
      expect(usd.outstanding).toBe(100);
      expect(usd.availableCredit).toBe(0);
    });
  });

  describe('3. Partial, exact, and overpayment calculations', () => {
    it('handles partial payment with outstanding > 0 and credit = 0', () => {
      const packages = [{ student_id: studentId, package_price: 18000, currency: 'INR' }];
      const payments = [{ student_id: studentId, amount: 10000, currency: 'INR' }];

      const [balance] = calculateStudentFinancialBalances(packages, payments, studentId);
      expect(balance.outstanding).toBe(8000);
      expect(balance.availableCredit).toBe(0);
    });

    it('handles exact payment with outstanding = 0 and credit = 0', () => {
      const packages = [{ student_id: studentId, package_price: 18000, currency: 'INR' }];
      const payments = [{ student_id: studentId, amount: 18000, currency: 'INR' }];

      const [balance] = calculateStudentFinancialBalances(packages, payments, studentId);
      expect(balance.outstanding).toBe(0);
      expect(balance.availableCredit).toBe(0);
    });

    it('handles overpayment with outstanding = 0 and credit = difference', () => {
      const packages = [{ student_id: studentId, package_price: 10000, currency: 'INR' }];
      const payments = [{ student_id: studentId, amount: 12500, currency: 'INR' }];

      const [balance] = calculateStudentFinancialBalances(packages, payments, studentId);
      expect(balance.outstanding).toBe(0);
      expect(balance.availableCredit).toBe(2500);
    });
  });

  describe('4. Renewals and carried forward classes', () => {
    it('ensures renewal monetary obligation is strictly package price, ignoring carried forward classes', () => {
      // Prior package: 12 classes purchased, 9 consumed, 3 carried forward, price 12000
      // Renewal: 12 new classes purchased (15 total available balance), price 14000
      const packages = [
        { student_id: studentId, package_price: 12000, currency: 'INR', status: 'EXPIRED' },
        { student_id: studentId, package_price: 14000, currency: 'INR', status: 'ACTIVE' },
      ];
      // Suppose student paid 12000 for pkg 1 and 7000 deposit for pkg 2
      const payments = [
        { student_id: studentId, amount: 12000, currency: 'INR' },
        { student_id: studentId, amount: 7000, currency: 'INR' },
      ];

      const [balance] = calculateStudentFinancialBalances(packages, payments, studentId);
      expect(balance.totalPayable).toBe(26000);
      expect(balance.totalPaid).toBe(19000);
      expect(balance.outstanding).toBe(7000);
      expect(balance.availableCredit).toBe(0);
    });
  });

  describe('5. Cancelled packages and voided payments treatment', () => {
    it('includes cancelled packages in total payable until an explicit business rule instructs otherwise', () => {
      const packages = [
        { student_id: studentId, package_price: 10000, currency: 'INR', status: 'CANCELLED' },
      ];
      const payments = [
        { student_id: studentId, amount: 5000, currency: 'INR' },
      ];

      const [balance] = calculateStudentFinancialBalances(packages, payments, studentId);
      expect(balance.totalPayable).toBe(10000);
      expect(balance.totalPaid).toBe(5000);
      expect(balance.outstanding).toBe(5000);
    });

    it('includes every recorded payment row for the student from the physical 6-column table', () => {
      // In canonical 4-table architecture, Payments sheet has 6 columns without a status column.
      // Voided payments are deleted from the sheet; every recorded payment row is included.
      const packages = [
        { student_id: studentId, package_price: 10000, currency: 'INR' },
      ];
      const payments = [
        { student_id: studentId, amount: 6000, currency: 'INR' },
        { student_id: studentId, amount: 4000, currency: 'INR' },
      ];

      const [balance] = calculateStudentFinancialBalances(packages, payments, studentId);
      expect(balance.totalPayable).toBe(10000);
      expect(balance.totalPaid).toBe(10000);
      expect(balance.outstanding).toBe(0);
      expect(balance.availableCredit).toBe(0);
    });
  });

  describe('6. Reliability and non-numeric data safety', () => {
    it('flags calculation as unreliable when package price is non-numeric or missing', () => {
      const packages = [
        { student_id: studentId, package_price: 'INVALID_PRICE', currency: 'INR' },
      ];
      const payments = [
        { student_id: studentId, amount: 5000, currency: 'INR' },
      ];

      const [balance] = calculateStudentFinancialBalances(packages, payments, studentId);
      expect(balance.isReliable).toBe(false);
    });

    it('flags calculation as unreliable when payment amount is non-numeric or missing', () => {
      const packages = [
        { student_id: studentId, package_price: 10000, currency: 'INR' },
      ];
      const payments = [
        { student_id: studentId, amount: undefined, currency: 'INR' },
      ];

      const [balance] = calculateStudentFinancialBalances(packages, payments, studentId);
      expect(balance.isReliable).toBe(false);
    });
  });

  describe('7. UI StudentFinancialCardView rendering', () => {
    it('renders loading state', () => {
      const html = renderToStaticMarkup(<StudentFinancialCardView balances={[]} loading={true} />);
      expect(html).toContain('Loading student financial balances…');
    });

    it('renders empty state when no balances exist', () => {
      const html = renderToStaticMarkup(<StudentFinancialCardView balances={[]} loading={false} />);
      expect(html).toContain('No package obligations or payment records found');
    });

    it('renders unreliable calculation warning message when isReliable is false', () => {
      const balances: CurrencyFinancialBalance[] = [
        {
          currency: 'EUR',
          totalPayable: 0,
          totalPaid: 0,
          outstanding: 0,
          availableCredit: 0,
          isReliable: false,
        },
      ];
      const html = renderToStaticMarkup(<StudentFinancialCardView balances={balances} loading={false} />);
      expect(html).toContain('Financial calculation unavailable for EUR');
      expect(html).toContain('Incomplete or non-numeric transaction values detected');
    });

    it('renders due amount with currency labels and negative/positive distinctions', () => {
      const balances: CurrencyFinancialBalance[] = [
        {
          currency: 'USD',
          totalPayable: 300,
          totalPaid: 200,
          outstanding: 100,
          availableCredit: 0,
          isReliable: true,
        },
        {
          currency: 'AUD',
          totalPayable: 450,
          totalPaid: 500,
          outstanding: 0,
          availableCredit: 50,
          isReliable: true,
        },
      ];

      const html = renderToStaticMarkup(<StudentFinancialCardView balances={balances} loading={false} />);

      // USD assertions
      expect(html).toContain('Total Package Payable (USD)');
      expect(html).toContain('Total Payments Received (USD)');
      expect(html).toContain('Outstanding Amount (USD)');
      expect(html).toContain('$100 due');
      expect(html).toContain('None'); // credit

      // AUD assertions
      expect(html).toContain('Total Package Payable (AUD)');
      expect(html).toContain('Total Payments Received (AUD)');
      expect(html).toContain('Outstanding Amount (AUD)');
      expect(html).toContain('Settled');
      expect(html).toContain('Available Credit / Excess (AUD)');
      expect(html).toContain('credit');
    });
  });
});

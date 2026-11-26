import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SidebarFooter } from '../../src/layout/SidebarFooter';
import { StudentSummary } from '../../src/domains/students/StudentSummary';
import { StudentFinancialCardView } from '../../src/domains/students/StudentFinancialCardView';
import { FinanceSummaryCards } from '../../src/domains/finances/FinanceSummaryCards';
import { FinanceToolbar } from '../../src/domains/finances/FinanceToolbar';
import { calculateFinanceEarnings } from '../../src/domains/finances/financialCalculations';
import { calculateStudentPerClassRate } from '../../src/domains/finances/packageRateCalculator';
import { Payment } from '../../src/domains/payments/paymentTypes';
import { Package } from '../../src/domains/packages/packageTypes';
import { Student } from '../../src/domains/students/studentTypes';

describe('Batch 4 UI/UX Refinements Verification', () => {
  describe('Change 1: Remove Email from Sidebar', () => {
    it('renders name, date/time and actions but does not render user email in expanded or collapsed states', () => {
      const mockUser = { uid: 'u1', email: 'shreya.admin@example.com', displayName: 'Shreya Agarwal' };
      const expandedHtml = renderToString(
        <SidebarFooter
          user={mockUser as any}
          displayName="Shreya Agarwal"
          initials="SA"
          activeSection="dashboard"
          isCollapsed={false}
          onNavigate={() => {}}
          onSignOut={() => {}}
        />
      );

      expect(expandedHtml).toContain('Shreya Agarwal');
      expect(expandedHtml).not.toContain('shreya.admin@example.com');
      expect(expandedHtml).not.toContain('Administrator');

      const collapsedHtml = renderToString(
        <SidebarFooter
          user={mockUser as any}
          displayName="Shreya Agarwal"
          initials="SA"
          activeSection="dashboard"
          isCollapsed={true}
          onNavigate={() => {}}
          onSignOut={() => {}}
        />
      );
      expect(collapsedHtml).not.toContain('shreya.admin@example.com');
    });
  });

  describe('Change 3: Remove Registered field globally from student UI', () => {
    it('renders Student ID without Registered text or date', () => {
      const student: Student = {
        student_id: 'STU_004',
        student_name: 'Aarav Sharma',
        status: 'ACTIVE',
        created_at: '2026-01-15T10:00:00Z',
      };
      const html = renderToString(<StudentSummary student={student} />);
      expect(html).toContain('STU_004');
      expect(html).not.toContain('Registered');
      expect(html).not.toContain('• Registered');
    });
  });

  describe('Change 4: Show Per-Class Rate in Student Financial Summary', () => {
    it('calculates and renders Per-Class Rate in student financial card', () => {
      const packages: Package[] = [
        {
          package_id: 'pkg_1',
          student_id: 'STU_004',
          package_price: 12500,
          classes_purchased: 32,
          currency: 'INR',
          status: 'ACTIVE',
        },
      ];
      const rate = calculateStudentPerClassRate('STU_004', packages, []);
      expect(rate.hasRate).toBe(true);
      expect(rate.inrRate).toBe(390.63);
      expect(rate.inrDisplay).toBe('₹390.63 / class');

      const balances = [
        {
          currency: 'INR',
          totalPayable: 12500,
          totalPaid: 12500,
          outstanding: 0,
          availableCredit: 0,
          isReliable: true,
        },
      ];

      const html = renderToString(
        <StudentFinancialCardView balances={balances} rateResult={rate} loading={false} />
      );

      expect(html).toContain('Per-Class Rate');
      expect(html).toContain('INR');
      expect(html).toContain('₹390.63 / class');
    });

    it('handles foreign currency with exchange rate safely and avoids division by zero', () => {
      const zeroClassesPkg: Package[] = [
        { package_id: 'pkg_zero', student_id: 'STU_005', package_price: 10000, classes_purchased: 0, currency: 'INR' },
      ];
      const zeroRate = calculateStudentPerClassRate('STU_005', zeroClassesPkg, []);
      expect(zeroRate.hasRate).toBe(false);

      const foreignPkgs: Package[] = [
        { package_id: 'pkg_usd', student_id: 'STU_006', package_price: 300, classes_purchased: 10, currency: 'USD' },
      ];
      const foreignRateNoFx = calculateStudentPerClassRate('STU_006', foreignPkgs, []);
      expect(foreignRateNoFx.hasRate).toBe(true);
      expect(foreignRateNoFx.localDisplay).toBe('$30.00 / class');
      expect(foreignRateNoFx.inrDisplay).toBe('—');
    });
  });

  describe('Change 5: Remove Archive Student button globally', () => {
    it('confirms Archive Student does not appear in source code or UI components', async () => {
      const fs = await import('fs');
      const profileSource = fs.readFileSync('src/domains/students/StudentProfilePage.tsx', 'utf8');
      expect(profileSource).not.toContain('Archive Student');
      expect(profileSource).not.toContain('setShowConfirmArchive');
      expect(profileSource).not.toContain('archiveStudent');
    });
  });

  describe('Change 6, 7 & 8: Finance Page Header, 3 Cards & Month Filter', () => {
    it('verifies PageHeader subtitle is omitted on FinancesPage source', async () => {
      const fs = await import('fs');
      const pageSource = fs.readFileSync('src/domains/finances/FinancesPage.tsx', 'utf8');
      expect(pageSource).toContain('<PageHeader title="Finances" />');
      expect(pageSource).not.toContain('subtitle="Unified ledger');
    });

    it('calculates Lifetime, Yearly, and Monthly earnings correctly with month selection', () => {
      const payments: Payment[] = [
        { payment_id: 'p1', amount: 5000, currency: 'INR', payment_date: '2026-11-05', status: 'RECORDED' },
        { payment_id: 'p2', amount: 3000, currency: 'INR', payment_date: '2026-11-20', status: 'RECORDED' },
        { payment_id: 'p3', amount: 4000, currency: 'INR', payment_date: '2026-10-15', status: 'RECORDED' },
        { payment_id: 'p4', amount: 10000, currency: 'INR', payment_date: '2025-05-10', status: 'RECORDED' },
        { payment_id: 'p5', amount: 2000, currency: 'INR', payment_date: '2026-11-12', status: 'VOID' }, // excluded
      ];

      const refDate = new Date('2026-11-26T12:00:00Z');
      const resNov = calculateFinanceEarnings(payments, 'Asia/Kolkata', '2026-11', refDate);
      // Lifetime: 5000 + 3000 + 4000 + 10000 = 22000
      expect(resNov.lifetimeEarnings).toBe(22000);
      // Yearly 2026: 5000 + 3000 + 4000 = 12000
      expect(resNov.yearlyEarnings).toBe(12000);
      // Monthly 2026-11: 5000 + 3000 = 8000
      expect(resNov.monthlyEarnings).toBe(8000);

      // Select October 2026
      const resOct = calculateFinanceEarnings(payments, 'Asia/Kolkata', '2026-10', refDate);
      expect(resOct.lifetimeEarnings).toBe(22000);
      expect(resOct.yearlyEarnings).toBe(12000);
      expect(resOct.monthlyEarnings).toBe(4000);
    });

    it('renders month input selector and removes from/to/export CSV in FinanceToolbar', () => {
      let changedFilter: any = null;
      const html = renderToString(
        <FinanceToolbar
          filter={{ selectedMonth: '2026-11', search: 'Aarav' }}
          onFilterChange={(f) => { changedFilter = f; }}
        />
      );

      expect(html).toContain('type="month"');
      expect(html).toContain('value="2026-11"');
      expect(html).not.toContain('From:');
      expect(html).not.toContain('To:');
      expect(html).not.toContain('Export Finances CSV');
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PageHeader } from '../../src/layout/PageHeader';
import { MeetingLinkButton } from '../../src/domains/meeting-links/MeetingLinkButton';
import { DashboardMiniCalendar } from '../../src/domains/dashboard/DashboardMiniCalendar';
import { calculateStudentPerClassRate, formatRateWithCurrency } from '../../src/domains/finances/packageRateCalculator';
import { StudentBalanceTable } from '../../src/domains/finances/StudentBalanceTable';
import {
  DashboardSkeleton,
  StudentsTableSkeleton,
  CalendarSkeleton,
  ClassScheduleSkeleton,
  FinancesSkeleton,
} from '../../src/components/feedback/Skeleton';
import { ClassSession } from '../../src/domains/classes/classTypes';
import { WeeklyScheduleEntry } from '../../src/domains/classes/scheduleApi';
import { Package } from '../../src/domains/packages/packageTypes';
import { Payment } from '../../src/domains/payments/paymentTypes';

describe('Batch 2 UI/UX Enhancements Suite', () => {
  it('Change 1: Standardized PageHeader renders matching visual styling and typography', () => {
    const html = renderToString(<PageHeader title="Students Directory" subtitle="All active and inactive student accounts" />);
    expect(html).toContain('Students Directory');
    expect(html).toContain('All active and inactive student accounts');
    expect(html).toContain('<h1');
  });

  it('Change 2: Dashboard calendar synchronizes recurring schedule on 27 November', () => {
    const schedules: WeeklyScheduleEntry[] = [
      {
        schedule_id: 'sch_nov27',
        student_id: 'STU_100',
        student_name: 'Aditi Rao',
        day_of_week: 'FRIDAY',
        start_time: '16:00',
        end_time: '17:00',
        is_active: true,
      },
    ];
    // 2026-11-27 is a Friday
    const html = renderToString(
      <DashboardMiniCalendar
        classes={[]}
        schedules={schedules}
        students={[{ student_id: 'STU_100', student_name: 'Aditi Rao', parent_name: 'P', parent_phone: '1', status: 'ACTIVE' }]}
        packages={[{ student_id: 'STU_100', package_name: 'P1', total_classes: 10, start_date: '2026-11-01', status: 'ACTIVE' }]}
        selectedDateKey="2026-11-27"
        onSelectDateKey={vi.fn()}
      />
    );
    expect(html).toContain('November 27, 2026 (Classes scheduled)');
  });

  it('Change 3: MeetingLinkButton renders clickable link and Copy button without separate Open button', () => {
    const html = renderToString(
      <MeetingLinkButton url="https://meet.google.com/xyz-uvwx-rst" compact />
    );
    expect(html).toContain('meet.google.com/xyz-uvwx-rst');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('Open ↗');
    expect(html).toContain('Copy');
  });

  it('Change 4: Skeletons render consistent layout placeholders and accessible markers', () => {
    const dashHtml = renderToString(<DashboardSkeleton />);
    expect(dashHtml).toContain('aria-busy="true"');

    const studentsHtml = renderToString(<StudentsTableSkeleton />);
    expect(studentsHtml).toContain('aria-busy="true"');

    const calHtml = renderToString(<CalendarSkeleton />);
    expect(calHtml).toContain('aria-busy="true"');

    const schedHtml = renderToString(<ClassScheduleSkeleton />);
    expect(schedHtml).toContain('aria-busy="true"');

    const finHtml = renderToString(<FinancesSkeleton />);
    expect(finHtml).toContain('aria-busy="true"');
  });

  it('Change 5: Calculates per-class package rate for INR and converted foreign currencies', () => {
    const pkgs: Package[] = [
      { student_id: 'STU_INR', package_name: 'P1', price: 8000, total_classes: 16, currency: 'INR', start_date: '2026-11-01', status: 'ACTIVE' },
      { student_id: 'STU_GBP', package_name: 'P2', price: 160, total_classes: 16, currency: 'GBP', start_date: '2026-11-01', status: 'ACTIVE' },
    ];
    const pays: Payment[] = [
      { payment_id: 'pay_1', student_id: 'STU_GBP', amount: 160, currency: 'GBP', in_inr: 16000, payment_date: '2026-11-02', payment_method: 'BANK_TRANSFER', status: 'RECORDED' },
    ];

    const inrResult = calculateStudentPerClassRate('STU_INR', pkgs, pays);
    expect(inrResult.hasRate).toBe(true);
    expect(inrResult.inrDisplay).toBe('₹500.00 / class');

    const gbpResult = calculateStudentPerClassRate('STU_GBP', pkgs, pays);
    expect(gbpResult.hasRate).toBe(true);
    expect(gbpResult.localDisplay).toBe('£10.00 / class');
    expect(gbpResult.inrDisplay).toBe('₹1,000.00 / class');
  });

  it('Change 5: StudentBalanceTable renders Per Class Rate column with INR and local currency', () => {
    const records = [
      {
        student_id: 'STU_GBP',
        student_name: 'Oliver Twist',
        packageTotalsByCurrency: { GBP: 160 },
        paymentTotalsByCurrency: { GBP: 160 },
        paymentCount: 1,
        perClassRate: {
          hasRate: true,
          inrDisplay: '₹1,000.00 / class',
          localDisplay: '£10.00 / class',
          localCurrency: 'GBP',
        },
      },
      {
        student_id: 'STU_EMPTY',
        student_name: 'No Package Student',
        packageTotalsByCurrency: {},
        paymentTotalsByCurrency: {},
        paymentCount: 0,
      },
    ];

    const html = renderToString(<StudentBalanceTable records={records} />);
    expect(html).toContain('Per Class Rate');
    expect(html).toContain('₹1,000.00 / class');
    expect(html).toContain('£10.00 / class');
  });
});

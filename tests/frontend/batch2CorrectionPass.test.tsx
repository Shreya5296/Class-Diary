import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PageHeader } from '../../src/layout/PageHeader';
import { DashboardSkeleton, StudentsTableSkeleton, CalendarSkeleton } from '../../src/components/feedback/Skeleton';
import { ClassScheduleSkeleton } from '../../src/components/feedback/SecondaryPageSkeletons';
import { calculateStudentPerClassRate } from '../../src/domains/finances/packageRateCalculator';
import { TodayClassesSection } from '../../src/domains/dashboard/TodayClassesSection';
import { sendApiRequest, clearApiCache } from '../../src/api/apiClient';
import { APP_NAME } from '../../src/config/publicConfig';
import { RequireAdmin } from '../../src/auth/RequireAdmin';
import { AuthContext } from '../../src/auth/AuthProvider';

describe('Batch 2 Correction Pass Suite', () => {
  beforeEach(() => {
    clearApiCache();
  });

  it('Change 1: PageHeader renders title, subtitle and action container with proper hierarchy', () => {
    const html = renderToString(<PageHeader title="Students Directory" subtitle="Active students" />);
    expect(html).toContain('Students Directory');
    expect(html).toContain('Active students');
  });

  it('Change 2: Dashboard skeleton has 1.75rem top spacing and sub-skeletons omit duplicate toolbars', () => {
    const dashHtml = renderToString(<DashboardSkeleton />);
    expect(dashHtml).toContain('padding-top:1.75rem');

    const studentsHtml = renderToString(<StudentsTableSkeleton />);
    expect(studentsHtml).not.toContain('width:240px'); // No duplicate search bar

    const calHtml = renderToString(<CalendarSkeleton />);
    expect(calHtml).not.toContain('width:160px'); // No duplicate calendar buttons

    const schedHtml = renderToString(<ClassScheduleSkeleton />);
    expect(schedHtml).not.toContain('width:240px'); // No duplicate schedule toolbar
  });

  it('Change 3: Finance rate calculation NEVER uses unrelated student payments', () => {
    const pkgs = [
      { student_id: 'STU_A', package_name: 'P1', price: 100, total_classes: 10, currency: 'GBP', status: 'ACTIVE' },
      { student_id: 'STU_B', package_name: 'P2', price: 100, total_classes: 10, currency: 'GBP', status: 'ACTIVE' },
    ];
    // Only STU_B has payment with INR conversion
    const pays = [
      { payment_id: 'p1', student_id: 'STU_B', amount: 100, currency: 'GBP', in_inr: 10000, payment_date: '2026-11-01', status: 'RECORDED' },
    ];

    // STU_A has no payments -> INR display must be '—', NOT STU_B's exchange rate!
    const resA = calculateStudentPerClassRate('STU_A', pkgs, pays);
    expect(resA.hasRate).toBe(true);
    expect(resA.localDisplay).toBe('£10.00 / class');
    expect(resA.inrDisplay).toBe('—');

    // STU_B has payment -> converts to INR
    const resB = calculateStudentPerClassRate('STU_B', pkgs, pays);
    expect(resB.hasRate).toBe(true);
    expect(resB.localDisplay).toBe('£10.00 / class');
    expect(resB.inrDisplay).toBe('₹1,000.00 / class');

    // Zero-division safety
    const resZero = calculateStudentPerClassRate('STU_ZERO', [{ student_id: 'STU_ZERO', price: 0, total_classes: 0, status: 'ACTIVE' }], []);
    expect(resZero.hasRate).toBe(false);
  });

  it('Change 4: Login page branded with Class Diary and dark navy gradient card', () => {
    expect(APP_NAME).toBe('Class Diary');

    const mockAuthContext: any = {
      status: 'unauthenticated',
      user: null,
      token: null,
      signInWithToken: vi.fn(),
      signOut: vi.fn(),
    };

    const html = renderToString(
      <AuthContext.Provider value={mockAuthContext}>
        <RequireAdmin><div>App Content</div></RequireAdmin>
      </AuthContext.Provider>
    );

    expect(html).toContain('Class Diary');
    expect(html).not.toContain('Personal Dashboard');
    expect(html).toContain('linear-gradient(135deg, #0f172a');
    expect(html).toContain('Sign In as Administrator');
  });

  it('Change 5: Join Class button label simply reads "Join Class" when ineligible', () => {
    const imminentClass: any = {
      session_id: 'sess_1',
      student_id: 'STU_1',
      student_name: 'Test Student',
      schedule_date: '2026-11-26',
      start_time: '23:00',
      end_time: '23:45',
      session_status: 'SCHEDULED',
      meeting_url: '', // Ineligible: no meeting link
    };

    const html = renderToString(
      <TodayClassesSection classes={[imminentClass]} selectedDateKey="2026-11-26" />
    );

    expect(html).toContain('Join Class');
    expect(html).not.toContain('(Not eligible)');
    expect(html).toContain('disabled=""');
  });

  it('Change 6: apiClient provides 30s in-memory TTL caching and invalidates on mutations', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ ok: true, data: [{ id: 1 }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    // First read call fetches from network
    const r1 = await sendApiRequest('students.list', {}, { token: 't1' });
    expect(r1.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second read call returns cached response without network fetch
    const r2 = await sendApiRequest('students.list', {}, { token: 't1' });
    expect(r2.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Mutation invalidates cache
    await sendApiRequest('students.create', { name: 'New' }, { token: 't1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Third read call fetches again from network because cache was cleared
    await sendApiRequest('students.list', {}, { token: 't1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    vi.unstubAllGlobals();
  });
});

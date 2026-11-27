import { describe, it, expect } from 'vitest';
import { generateAttentionAlerts } from '../../src/domains/dashboard/attentionAlerts';
import { checkPackageFeeAlert, formatAlertDdMmYyyy } from '../../src/domains/dashboard/attentionAlertsHelpers';
import { calculateStudentOutstanding } from '../../src/domains/finances/studentOutstanding';
import { Student } from '../../src/domains/students/studentTypes';
import { Package } from '../../src/domains/packages/packageTypes';
import { Payment } from '../../src/domains/payments/paymentTypes';

describe('Point 2: Package Fee Alerts & Outstanding Money', () => {
  const referenceDateStr = '2026-11-20'; // Reference date: 2026-11-20

  const createActiveStudent = (id = 'STU_FEE_1', name = 'Rehaan'): Student => ({
    student_id: id,
    student_name: name,
    first_name: name,
    parent_name: 'Parent',
    phone: '+91 9999999999',
    parent_phone: '+91 9999999999',
    status: 'ACTIVE',
    primary_meeting_link: 'https://meet.google.com/abc-defg-hij',
  });

  describe('1. Shared Outstanding Function (studentOutstanding.ts)', () => {
    it('calculates package payable minus payments received per student and currency', () => {
      const packages: Package[] = [
        {
          student_id: 'STU_FEE_1',
          package_name: 'Pkg 1',
          total_classes: 40,
          package_price: 100000,
          currency: 'INR',
          start_date: '2026-01-01',
          status: 'ACTIVE',
        },
      ];
      const payments: Payment[] = [
        {
          payment_id: 'pay_1',
          student_id: 'STU_FEE_1',
          amount: 25000,
          currency: 'INR',
          payment_date: '2026-04-01',
          payment_method: 'UPI',
          status: 'RECORDED',
        },
        {
          payment_id: 'pay_2',
          student_id: 'STU_FEE_1',
          amount: 50000,
          currency: 'INR',
          payment_date: '2026-07-01',
          payment_method: 'UPI',
          status: 'RECORDED',
        },
      ];

      const balances = calculateStudentOutstanding(packages, payments, 'STU_FEE_1');
      expect(balances).toHaveLength(1);
      expect(balances[0].currency).toBe('INR');
      expect(balances[0].totalPayable).toBe(100000);
      expect(balances[0].totalPaid).toBe(75000);
      expect(balances[0].outstanding).toBe(25000);
      expect(balances[0].availableCredit).toBe(0);
    });

    it('ignores VOID and CANCELLED packages and payments', () => {
      const packages: Package[] = [
        { student_id: 's1', package_name: 'Valid', total_classes: 10, package_price: 50000, currency: 'INR', start_date: '2026-01-01', status: 'ACTIVE' },
        { student_id: 's1', package_name: 'Void', total_classes: 10, package_price: 30000, currency: 'INR', start_date: '2026-01-01', status: 'VOID' },
        { student_id: 's1', package_name: 'Cancelled', total_classes: 10, package_price: 20000, currency: 'INR', start_date: '2026-01-01', status: 'CANCELLED' },
      ];
      const payments: Payment[] = [
        { payment_id: 'p1', student_id: 's1', amount: 15000, currency: 'INR', payment_date: '2026-02-01', payment_method: 'UPI', status: 'RECORDED' },
        { payment_id: 'p2', student_id: 's1', amount: 10000, currency: 'INR', payment_date: '2026-03-01', payment_method: 'UPI', status: 'VOID' },
        { payment_id: 'p3', student_id: 's1', amount: 5000, currency: 'INR', payment_date: '2026-04-01', payment_method: 'UPI', status: 'CANCELLED' },
      ];

      const balances = calculateStudentOutstanding(packages, payments, 's1');
      expect(balances).toHaveLength(1);
      expect(balances[0].totalPayable).toBe(50000);
      expect(balances[0].totalPaid).toBe(15000);
      expect(balances[0].outstanding).toBe(35000);
    });
  });

  describe('2. Date Formatter Helper', () => {
    it('formats YYYY-MM-DD to DD-MM-YYYY', () => {
      expect(formatAlertDdMmYyyy('2026-11-19')).toBe('19-11-2026');
      expect(formatAlertDdMmYyyy('2026-12-01')).toBe('01-12-2026');
    });
  });

  describe('3. Required Unit Tests for Alert Rule', () => {
    it('due in 10 days = alert (warning, pending, "Fee due in 10 days: Rs X")', () => {
      // 2026-11-20 + 10 days = 2026-11-30
      const student = createActiveStudent('s_10d', 'Test Ten');
      const packages: Package[] = [{
        student_id: 's_10d', package_name: 'Pack', total_classes: 20, package_price: 30000,
        currency: 'INR', start_date: '2026-01-01', next_due_date: '2026-11-30', status: 'ACTIVE',
      }];
      const payments: Payment[] = [{
        payment_id: 'p1', student_id: 's_10d', amount: 10000, currency: 'INR',
        payment_date: '2026-01-10', payment_method: 'UPI', status: 'RECORDED',
      }];

      const alerts = generateAttentionAlerts({
        students: [student],
        schedules: [{ student_id: 's_10d', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00', is_active: true }],
        meetingLinks: [],
        packages,
        payments,
        referenceDateStr,
      });

      const feeAlert = alerts.find((a) => a.studentId === 's_10d' && a.category === 'fee');
      expect(feeAlert).toBeDefined();
      expect(feeAlert?.severity).toBe('warning');
      expect(feeAlert?.urgency).toBe('pending');
      expect(feeAlert?.reason).toBe('Fee due in 10 days: ₹20,000');
      expect(feeAlert?.actionLabel).toBe('View Fees');
      expect(feeAlert?.targetSection).toBe('finances');
    });

    it('due in 11 days = no alert', () => {
      // 2026-11-20 + 11 days = 2026-12-01
      const student = createActiveStudent('s_11d', 'Test Eleven');
      const packages: Package[] = [{
        student_id: 's_11d', package_name: 'Pack', total_classes: 20, package_price: 30000,
        currency: 'INR', start_date: '2026-01-01', next_due_date: '2026-12-01', status: 'ACTIVE',
      }];
      const payments: Payment[] = [{
        payment_id: 'p1', student_id: 's_11d', amount: 10000, currency: 'INR',
        payment_date: '2026-01-10', payment_method: 'UPI', status: 'RECORDED',
      }];

      const alerts = generateAttentionAlerts({
        students: [student],
        schedules: [{ student_id: 's_11d', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00', is_active: true }],
        meetingLinks: [],
        packages,
        payments,
        referenceDateStr,
      });

      const feeAlert = alerts.find((a) => a.studentId === 's_11d' && a.category === 'fee');
      expect(feeAlert).toBeUndefined();
    });

    it('due yesterday = overdue critical ("Fee overdue: Rs X (was due DD-MM-YYYY)")', () => {
      // 2026-11-20 yesterday = 2026-11-19
      const student = createActiveStudent('s_yest', 'Test Yesterday');
      const packages: Package[] = [{
        student_id: 's_yest', package_name: 'Pack', total_classes: 20, package_price: 50000,
        currency: 'INR', start_date: '2026-01-01', next_due_date: '2026-11-19', status: 'ACTIVE',
      }];
      const payments: Payment[] = [{
        payment_id: 'p1', student_id: 's_yest', amount: 20000, currency: 'INR',
        payment_date: '2026-01-10', payment_method: 'UPI', status: 'RECORDED',
      }];

      const alerts = generateAttentionAlerts({
        students: [student],
        schedules: [{ student_id: 's_yest', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00', is_active: true }],
        meetingLinks: [],
        packages,
        payments,
        referenceDateStr,
      });

      const feeAlert = alerts.find((a) => a.studentId === 's_yest' && a.category === 'fee');
      expect(feeAlert).toBeDefined();
      expect(feeAlert?.severity).toBe('danger');
      expect(feeAlert?.urgency).toBe('critical');
      expect(feeAlert?.reason).toBe('Fee overdue: ₹30,000 (was due 19-11-2026)');
    });

    it('outstanding 0 = no alert', () => {
      const student = createActiveStudent('s_settled', 'Test Settled');
      const packages: Package[] = [{
        student_id: 's_settled', package_name: 'Pack', total_classes: 20, package_price: 25000,
        currency: 'INR', start_date: '2026-01-01', next_due_date: '2026-11-22', status: 'ACTIVE',
      }];
      const payments: Payment[] = [{
        payment_id: 'p1', student_id: 's_settled', amount: 25000, currency: 'INR',
        payment_date: '2026-01-10', payment_method: 'UPI', status: 'RECORDED',
      }];

      const alerts = generateAttentionAlerts({
        students: [student],
        schedules: [{ student_id: 's_settled', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00', is_active: true }],
        meetingLinks: [],
        packages,
        payments,
        referenceDateStr,
      });

      const feeAlert = alerts.find((a) => a.studentId === 's_settled' && a.category === 'fee');
      expect(feeAlert).toBeUndefined();
    });

    it('no next_due_date = "Fee outstanding: Rs X (no due date set)" with urgency pending', () => {
      const student = createActiveStudent('s_nodue', 'Test NoDue');
      const packages: Package[] = [{
        student_id: 's_nodue', package_name: 'Pack', total_classes: 20, package_price: 40000,
        currency: 'INR', start_date: '2026-01-01', next_due_date: '', status: 'ACTIVE',
      }];
      const payments: Payment[] = [{
        payment_id: 'p1', student_id: 's_nodue', amount: 15000, currency: 'INR',
        payment_date: '2026-01-10', payment_method: 'UPI', status: 'RECORDED',
      }];

      const alerts = generateAttentionAlerts({
        students: [student],
        schedules: [{ student_id: 's_nodue', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00', is_active: true }],
        meetingLinks: [],
        packages,
        payments,
        referenceDateStr,
      });

      const feeAlert = alerts.find((a) => a.studentId === 's_nodue' && a.category === 'fee');
      expect(feeAlert).toBeDefined();
      expect(feeAlert?.severity).toBe('warning');
      expect(feeAlert?.urgency).toBe('pending');
      expect(feeAlert?.reason).toBe('Fee outstanding: ₹25,000 (no due date set)');
    });

    it('archived student = no alert', () => {
      const student: Student = {
        ...createActiveStudent('s_arch', 'Test Archived'),
        status: 'ARCHIVED',
      };
      const packages: Package[] = [{
        student_id: 's_arch', package_name: 'Pack', total_classes: 20, package_price: 50000,
        currency: 'INR', start_date: '2026-01-01', next_due_date: '2026-11-22', status: 'ACTIVE',
      }];
      const payments: Payment[] = [];

      const alerts = generateAttentionAlerts({
        students: [student],
        schedules: [{ student_id: 's_arch', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00', is_active: true }],
        meetingLinks: [],
        packages,
        payments,
        referenceDateStr,
      });

      const feeAlert = alerts.find((a) => a.studentId === 's_arch' && a.category === 'fee');
      expect(feeAlert).toBeUndefined();
    });

    it('inactive student = no alert', () => {
      const student: Student = {
        ...createActiveStudent('s_inact', 'Test Inactive'),
        status: 'INACTIVE',
      };
      const packages: Package[] = [{
        student_id: 's_inact', package_name: 'Pack', total_classes: 20, package_price: 50000,
        currency: 'INR', start_date: '2026-01-01', next_due_date: '2026-11-22', status: 'ACTIVE',
      }];
      const payments: Payment[] = [];

      const alerts = generateAttentionAlerts({
        students: [student],
        schedules: [{ student_id: 's_inact', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00', is_active: true }],
        meetingLinks: [],
        packages,
        payments,
        referenceDateStr,
      });

      const feeAlert = alerts.find((a) => a.studentId === 's_inact' && a.category === 'fee');
      expect(feeAlert).toBeUndefined();
    });

    it('two packages = earliest due date used', () => {
      const student = createActiveStudent('s_two', 'Test TwoPkgs');
      const packages: Package[] = [
        {
          student_id: 's_two', package_name: 'Pkg Late', total_classes: 20, package_price: 20000,
          currency: 'INR', start_date: '2026-01-01', next_due_date: '2026-11-29', status: 'ACTIVE',
        },
        {
          student_id: 's_two', package_name: 'Pkg Early', total_classes: 20, package_price: 30000,
          currency: 'INR', start_date: '2026-01-01', next_due_date: '2026-11-23', status: 'ACTIVE',
        },
      ];
      const payments: Payment[] = [{
        payment_id: 'p1', student_id: 's_two', amount: 10000, currency: 'INR',
        payment_date: '2026-01-10', payment_method: 'UPI', status: 'RECORDED',
      }];

      // 2026-11-20: Earliest due date is 2026-11-23 (3 days away)
      const alerts = generateAttentionAlerts({
        students: [student],
        schedules: [{ student_id: 's_two', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00', is_active: true }],
        meetingLinks: [],
        packages,
        payments,
        referenceDateStr,
      });

      const feeAlert = alerts.find((a) => a.studentId === 's_two' && a.category === 'fee');
      expect(feeAlert).toBeDefined();
      expect(feeAlert?.reason).toBe('Fee due in 3 days: ₹40,000');
    });

    it('deduplicates alerts for same student: keeps new alert over legacy fees list', () => {
      const student = createActiveStudent('s_dup', 'Test Deduplication');
      const packages: Package[] = [{
        student_id: 's_dup', package_name: 'Pack', total_classes: 20, package_price: 50000,
        currency: 'INR', start_date: '2026-01-01', next_due_date: '2026-11-25', status: 'ACTIVE',
      }];
      const payments: Payment[] = [{
        payment_id: 'p1', student_id: 's_dup', amount: 20000, currency: 'INR',
        payment_date: '2026-01-10', payment_method: 'UPI', status: 'RECORDED',
      }];
      const legacyFees = [{
        fee_id: 'f_old', student_id: 's_dup', amount_due: 10000, outstanding_balance: 10000,
        due_date: '2026-11-22', status: 'PENDING',
      }];

      const alerts = generateAttentionAlerts({
        students: [student],
        schedules: [{ student_id: 's_dup', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00', is_active: true }],
        meetingLinks: [],
        packages,
        payments,
        fees: legacyFees,
        referenceDateStr,
      });

      const feeAlerts = alerts.filter((a) => a.studentId === 's_dup' && a.category === 'fee');
      expect(feeAlerts).toHaveLength(1);
      expect(feeAlerts[0].reason).toBe('Fee due in 5 days: ₹30,000');
    });

    it('formats foreign currency symbols correctly (e.g. USD)', () => {
      const student = createActiveStudent('s_usd', 'US Student');
      const packages: Package[] = [{
        student_id: 's_usd', package_name: 'US Pack', total_classes: 10, package_price: 500,
        currency: 'USD', start_date: '2026-01-01', next_due_date: '2026-11-24', status: 'ACTIVE',
      }];
      const payments: Payment[] = [{
        payment_id: 'p1', student_id: 's_usd', amount: 200, currency: 'USD',
        payment_date: '2026-01-10', payment_method: 'BANK_TRANSFER', status: 'RECORDED',
      }];

      const alerts = generateAttentionAlerts({
        students: [student],
        schedules: [{ student_id: 's_usd', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00', is_active: true }],
        meetingLinks: [],
        packages,
        payments,
        referenceDateStr,
      });

      const feeAlert = alerts.find((a) => a.studentId === 's_usd' && a.category === 'fee');
      expect(feeAlert).toBeDefined();
      expect(feeAlert?.reason).toBe('Fee due in 4 days: $300');
    });
  });
});

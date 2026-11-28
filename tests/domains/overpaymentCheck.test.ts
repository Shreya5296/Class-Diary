import { describe, it, expect } from 'vitest';
import { checkOverpayment } from '../../src/domains/finances/overpaymentCheck';
import { Package } from '../../src/domains/packages/packageTypes';
import { Payment } from '../../src/domains/payments/paymentTypes';

describe('Fix L1: checkOverpayment rule', () => {
  const mockPackages: Package[] = [
    {
      package_id: 'pkg_1',
      student_id: 'STU_100',
      student_name: 'Test Student',
      package_price: 600,
      currency: 'INR',
      status: 'ACTIVE',
    } as Package,
  ];

  it('equal amount to outstanding returns no warning', () => {
    const payments: Payment[] = []; // outstanding = 600
    const result = checkOverpayment(600, 'INR', 'STU_100', mockPackages, payments);
    expect(result.isOverpayment).toBe(false);
    expect(result.warningMessage).toBe('');
  });

  it('less amount than outstanding returns no warning', () => {
    const payments: Payment[] = []; // outstanding = 600
    const result = checkOverpayment(500, 'INR', 'STU_100', mockPackages, payments);
    expect(result.isOverpayment).toBe(false);
    expect(result.warningMessage).toBe('');
  });

  it('more amount than outstanding returns warning with exact diff and outstanding', () => {
    const payments: Payment[] = []; // outstanding = 600
    const result = checkOverpayment(700, 'INR', 'STU_100', mockPackages, payments);
    expect(result.isOverpayment).toBe(true);
    expect(result.excessAmount).toBe(100);
    expect(result.outstanding).toBe(600);
    expect(result.warningMessage).toBe('This is Rs 100 more than the outstanding Rs 600. Save anyway?');
  });

  it('zero outstanding returns warning when paying any positive amount', () => {
    // 600 payable, 600 paid -> outstanding = 0
    const payments: Payment[] = [
      { payment_id: 'pay_1', student_id: 'STU_100', amount: 600, currency: 'INR', status: 'PAID' } as Payment,
    ];
    const result = checkOverpayment(500, 'INR', 'STU_100', mockPackages, payments);
    expect(result.isOverpayment).toBe(true);
    expect(result.excessAmount).toBe(500);
    expect(result.outstanding).toBe(0);
    expect(result.warningMessage).toBe('This is Rs 500 more than the outstanding Rs 0. Save anyway?');
  });

  it('negative outstanding (student already in excess credit) returns warning', () => {
    // 600 payable, 700 paid -> excess credit = 100, outstanding = 0
    const payments: Payment[] = [
      { payment_id: 'pay_1', student_id: 'STU_100', amount: 700, currency: 'INR', status: 'PAID' } as Payment,
    ];
    const result = checkOverpayment(200, 'INR', 'STU_100', mockPackages, payments);
    expect(result.isOverpayment).toBe(true);
    expect(result.excessAmount).toBe(200);
    expect(result.outstanding).toBe(0);
    expect(result.warningMessage).toBe('This is Rs 200 more than the outstanding Rs 0. Save anyway?');
  });
});

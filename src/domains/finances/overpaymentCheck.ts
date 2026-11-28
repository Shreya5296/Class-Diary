import { Package } from '../packages/packageTypes';
import { Payment } from '../payments/paymentTypes';
import { calculateStudentOutstanding } from './studentOutstanding';

export interface OverpaymentWarningResult {
  isOverpayment: boolean;
  excessAmount: number;
  outstanding: number;
  currency: string;
  warningMessage: string;
}

export function checkOverpayment(
  amount: number,
  currency: string,
  studentId: string,
  packages: Package[],
  payments: Payment[]
): OverpaymentWarningResult {
  const normCur = (currency || 'INR').trim().toUpperCase();
  const balances = calculateStudentOutstanding(packages, payments, studentId);
  const curBalance = balances.find((b) => b.currency.toUpperCase() === normCur);
  const outstanding = curBalance ? Math.max(0, curBalance.outstanding) : 0;

  if (amount > outstanding || (outstanding <= 0 && amount > 0)) {
    const excess = Math.round(Math.max(0, amount - outstanding) * 100) / 100;
    const curPrefix = normCur === 'INR' ? 'Rs ' : `${normCur} `;
    return {
      isOverpayment: true,
      excessAmount: excess,
      outstanding,
      currency: normCur,
      warningMessage: `This is ${curPrefix}${excess.toLocaleString()} more than the outstanding ${curPrefix}${outstanding.toLocaleString()}. Save anyway?`,
    };
  }

  return {
    isOverpayment: false,
    excessAmount: 0,
    outstanding,
    currency: normCur,
    warningMessage: '',
  };
}

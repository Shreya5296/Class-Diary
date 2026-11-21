import { Payment } from '../payments/paymentTypes';
import { toInputDateFormat } from '../../lib/dateFormat';

/**
 * Checks if a payment record is valid and completed/recorded (excludes VOID, CANCELLED, REVERSED).
 */
export function isValidRecordedPayment(p: Payment): boolean {
  const status = String(p.payment_status || p.status || '').trim().toUpperCase();
  if (status === 'VOID' || status === 'CANCELLED' || status === 'REVERSED') {
    return false;
  }
  return true;
}

/**
 * Returns the recorded INR equivalent amount for a payment.
 * If in_inr is recorded, it takes precedence.
 * If currency is INR, uses amount.
 * Foreign currency payments without recorded in_inr return 0 to prevent synthetic FX invention.
 */
export function getPaymentInrAmount(p: Payment): number {
  if (!isValidRecordedPayment(p)) return 0;
  const cur = (p.currency || 'INR').trim().toUpperCase();
  const rawInInr = p.in_inr !== undefined && p.in_inr !== null ? Number(p.in_inr) : NaN;
  if (!isNaN(rawInInr) && rawInInr > 0) {
    return rawInInr;
  }
  if (cur === 'INR') {
    const amt = Number(p.amount || 0);
    return isNaN(amt) ? 0 : amt;
  }
  return 0;
}

/**
 * Resolves the calendar date string (YYYY-MM-DD) of a payment in the specified timeZone.
 */
export function getPaymentDateInTz(paymentDate: string | Date | undefined, timeZone: string): string {
  if (!paymentDate) return '';
  if (typeof paymentDate === 'string') {
    const trimmed = paymentDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return toInputDateFormat(d, timeZone);
    }
    return trimmed.slice(0, 10);
  }
  if (paymentDate instanceof Date && !isNaN(paymentDate.getTime())) {
    return toInputDateFormat(paymentDate, timeZone);
  }
  return '';
}

export interface MonthlyAndYearlyEarnings {
  monthlyEarnings: number;
  yearlyEarnings: number;
}

/**
 * Calculates monthly and yearly earnings in INR for valid recorded payments based on active timezone.
 */
export function calculateMonthlyAndYearlyEarnings(
  payments: Payment[],
  timeZone: string = 'Asia/Kolkata',
  referenceDate: Date = new Date()
): MonthlyAndYearlyEarnings {
  const todayStr = toInputDateFormat(referenceDate, timeZone);
  const currentYearStr = todayStr.slice(0, 4);
  const currentMonthStr = todayStr.slice(0, 7);

  let monthlyEarnings = 0;
  let yearlyEarnings = 0;

  for (const p of payments) {
    if (!isValidRecordedPayment(p)) continue;
    const payDateInTz = getPaymentDateInTz(p.payment_date, timeZone);
    if (!payDateInTz) continue;

    const amtInr = getPaymentInrAmount(p);
    if (amtInr <= 0) continue;

    if (payDateInTz.startsWith(currentYearStr)) {
      yearlyEarnings += amtInr;
      if (payDateInTz.startsWith(currentMonthStr)) {
        monthlyEarnings += amtInr;
      }
    }
  }

  return {
    monthlyEarnings: Math.round(monthlyEarnings * 100) / 100,
    yearlyEarnings: Math.round(yearlyEarnings * 100) / 100,
  };
}

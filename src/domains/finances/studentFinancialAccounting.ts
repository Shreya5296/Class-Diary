import {
  calculateStudentOutstanding,
  StudentCurrencyOutstanding,
  OutstandingPackageInput,
  OutstandingPaymentInput,
} from './studentOutstanding';

export type CurrencyFinancialBalance = StudentCurrencyOutstanding;
export type StudentFinancialEntityPackage = OutstandingPackageInput;
export type StudentFinancialEntityPayment = OutstandingPaymentInput;

/**
 * Confirmed Accounting Rule:
 * Outstanding Amount = Total Package Amount Payable − Total Recorded Payments Received.
 * Calculated separately for each currency across all historical and current packages.
 * Uses shared calculateStudentOutstanding implementation so profile, finances and dashboard match.
 */
export function calculateStudentFinancialBalances(
  packages: StudentFinancialEntityPackage[],
  payments: StudentFinancialEntityPayment[],
  studentId: string
): CurrencyFinancialBalance[] {
  return calculateStudentOutstanding(packages, payments, studentId);
}

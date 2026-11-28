import { Payment } from '../payments/paymentTypes';
import { StudentPerClassRateResult } from './packageRateCalculator';
import { FinanceRangeType } from './financeDateRanges';

export interface CurrencyTotals {
  [currency: string]: number;
}

export interface FinancesSummaryData {
  packagesByCurrency: CurrencyTotals;
  paymentsByCurrency: CurrencyTotals;
  totalRecordedInr: number;
}

export interface FinancialSummary {
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding?: number;
  currency: string;
  packagesByCurrency?: CurrencyTotals;
  paymentsByCurrency?: CurrencyTotals;
  totalRecordedInr?: number;
}

export interface FinanceFilter {
  search?: string;
  selectedMonth?: string;
  startDate?: string;
  endDate?: string;
  rangeType?: FinanceRangeType;
}

export interface StudentFinancialRecord {
  student_id: string;
  student_name: string;
  packageTotalsByCurrency: CurrencyTotals;
  paymentTotalsByCurrency: CurrencyTotals;
  paymentCount: number;
  lastPaymentDate?: string;
  recordedInrEquivalent?: number;
  perClassRate?: StudentPerClassRateResult;
}

export type StudentBalanceRecord = StudentFinancialRecord;

export type FinanceTab = 'history' | 'balances';

export type { Payment };

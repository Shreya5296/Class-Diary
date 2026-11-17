import { Payment } from '../../src/domains/payments/paymentTypes';

export interface FeeObligation {
  fee_id: string;
  fee_obligation_id?: string;
  student_id: string;
  student_name?: string;
  package_id?: string;
  description: string;
  obligation_description?: string;
  amount_due: number;
  credit_applied?: number;
  currency?: string;
  issue_date?: string;
  due_date: string;
  status: 'OPEN' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID' | string;
  obligation_status?: string;
  amount_paid: number;
  paid_amount?: number;
  outstanding_balance: number;
  outstanding_amount?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CurrencyCreditSummary {
  currency: string;
  unappliedCredit: number;
  totalPaid: number;
  totalBilled: number;
  outstandingBalance: number;
}

export function calculateStudentCredits(
  fees: FeeObligation[],
  payments: Payment[],
  studentId?: string
): CurrencyCreditSummary[] {
  const activeFees = fees.filter(
    (f) =>
      Boolean(f) &&
      (!studentId || f.student_id === studentId) &&
      f.status !== 'VOID' &&
      (f as unknown as { obligation_status?: string }).obligation_status !== 'VOID'
  );
  const activePayments = payments.filter(
    (p) =>
      Boolean(p) &&
      (!studentId || p.student_id === studentId) &&
      p.status !== 'VOID' &&
      (p as unknown as { payment_status?: string }).payment_status !== 'VOID'
  );

  const currencies = new Set<string>();
  activeFees.forEach((f) => currencies.add((f as unknown as { currency?: string }).currency || 'INR'));
  activePayments.forEach((p) => currencies.add((p as unknown as { currency?: string }).currency || 'INR'));

  if (currencies.size === 0) {
    currencies.add('INR');
  }

  const summaries: CurrencyCreditSummary[] = [];

  for (const curr of Array.from(currencies)) {
    const currFees = activeFees.filter(
      (f) => ((f as unknown as { currency?: string }).currency || 'INR') === curr
    );
    const currPayments = activePayments.filter(
      (p) => ((p as unknown as { currency?: string }).currency || 'INR') === curr
    );

    const totalPaid = currPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalBilled = currFees.reduce((sum, f) => sum + (Number(f.amount_due) || 0), 0);
    const totalCreditApplied = currFees.reduce((sum, f) => sum + (Number(f.credit_applied) || 0), 0);

    const appliedPerFee: Record<string, number> = {};
    for (const p of currPayments) {
      const fid = p.fee_id || p.fee_obligation_id;
      if (fid) {
        const fee = currFees.find((f) => (f.fee_id === fid || f.fee_obligation_id === fid));
        if (fee) {
          const prev = appliedPerFee[fid] || 0;
          const maxApplicable = Math.max(0, (Number(fee.amount_due) || 0) - (Number(fee.credit_applied) || 0));
          const toApply = Math.min(Number(p.amount) || 0, Math.max(0, maxApplicable - prev));
          appliedPerFee[fid] = prev + toApply;
        }
      }
    }

    const totalApplied = Object.values(appliedPerFee).reduce((sum, a) => sum + a, 0);
    const unappliedCredit = Math.max(0, totalPaid - (totalApplied + totalCreditApplied));
    const outstandingBalance = Math.max(0, totalBilled - (totalApplied + totalCreditApplied));

    summaries.push({
      currency: curr,
      unappliedCredit: Math.round(unappliedCredit * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalBilled: Math.round(totalBilled * 100) / 100,
      outstandingBalance: Math.round(outstandingBalance * 100) / 100,
    });
  }

  return summaries;
}

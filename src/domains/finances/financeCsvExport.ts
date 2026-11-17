import { FinancialSummary, Payment, FinancesSummaryData } from './financeTypes';

export function exportFinancesCsv(
  summary: FinancialSummary | null,
  payments: Payment[],
  currencyTotals?: FinancesSummaryData
): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const rows: string[] = [];

  rows.push('--- FINANCIAL SUMMARY ---');
  rows.push('Metric,Amount,Currency');
  if (currencyTotals) {
    for (const [cur, amt] of Object.entries(currencyTotals.packagesByCurrency)) {
      rows.push(`Lifetime Package Value (${cur}),${amt},${cur}`);
    }
    for (const [cur, amt] of Object.entries(currencyTotals.paymentsByCurrency)) {
      rows.push(`Lifetime Payments Received (${cur}),${amt},${cur}`);
    }
    rows.push(`Total Recorded INR Equivalent,${currencyTotals.totalRecordedInr},INR`);
  } else {
    rows.push(`Total Invoiced,${summary?.totalInvoiced ?? 0},${summary?.currency ?? 'INR'}`);
    rows.push(`Total Collected,${summary?.totalCollected ?? 0},${summary?.currency ?? 'INR'}`);
  }
  rows.push('');

  rows.push('--- TRANSACTION RECORDS ---');
  rows.push('Date,Student Name,Student ID,Amount,Currency,Recorded INR Equivalent');

  for (const p of payments) {
    const pDate = p.payment_date ? String(p.payment_date).slice(0, 10) : '';
    const name = `"${(p.student_name || '').replace(/"/g, '""')}"`;
    const sid = `"${(p.student_id || '').replace(/"/g, '""')}"`;
    const amt = p.amount || 0;
    const curr = p.currency || 'INR';
    const inInr = (p.in_inr !== undefined && p.in_inr !== null && Number(p.in_inr) > 0) ? Number(p.in_inr) : '';

    rows.push(`${pDate},${name},${sid},${amt},${curr},${inInr}`);
  }

  const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
  const link = document.createElement('a');
  link.setAttribute('href', csvContent);
  link.setAttribute('download', `finances_report_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

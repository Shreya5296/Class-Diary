import { Package } from '../packages/packageTypes';
import { Payment } from '../payments/paymentTypes';
import { StudentFinancialRecord } from './financeTypes';
import { calculateStudentPerClassRate } from './packageRateCalculator';

export function buildStudentFinancialRecords(
  packages: Package[],
  payments: Payment[],
  search?: string
): StudentFinancialRecord[] {
  const map = new Map<string, StudentFinancialRecord>();

  for (const pkg of packages) {
    const status = String(pkg.status || (pkg as any).package_status || '').trim().toUpperCase();
    if (status === 'VOID' || status === 'CANCELLED') continue;

    const sid = pkg.student_id || '_unknown_';
    const name = pkg.student_name || sid;
    const cur = (pkg.currency || 'INR').trim().toUpperCase();
    const price = Number(pkg.package_price || pkg.price || 0);
    const existing = map.get(sid) || {
      student_id: sid,
      student_name: name,
      packageTotalsByCurrency: {},
      paymentTotalsByCurrency: {},
      paymentCount: 0,
    };
    existing.packageTotalsByCurrency[cur] = (existing.packageTotalsByCurrency[cur] || 0) + price;
    map.set(sid, existing);
  }

  for (const p of payments) {
    const status = String(p.status || (p as any).payment_status || '').trim().toUpperCase();
    if (status === 'VOID' || status === 'CANCELLED') continue;

    const sid = p.student_id || '_unknown_';
    const name = p.student_name || sid;
    const cur = (p.currency || 'INR').trim().toUpperCase();
    const amt = Number(p.amount || 0);
    const existing = map.get(sid) || {
      student_id: sid,
      student_name: name,
      packageTotalsByCurrency: {},
      paymentTotalsByCurrency: {},
      paymentCount: 0,
    };
    existing.paymentTotalsByCurrency[cur] = (existing.paymentTotalsByCurrency[cur] || 0) + amt;
    existing.paymentCount += 1;
    if (p.in_inr && Number(p.in_inr) > 0) {
      existing.recordedInrEquivalent = (existing.recordedInrEquivalent || 0) + Number(p.in_inr);
    }
    if (!existing.lastPaymentDate || p.payment_date > existing.lastPaymentDate) {
      existing.lastPaymentDate = p.payment_date;
    }
    map.set(sid, existing);
  }

  for (const [sid, record] of map.entries()) {
    record.perClassRate = calculateStudentPerClassRate(sid, packages, payments);
  }

  const q = (search || '').trim().toLowerCase();
  return Array.from(map.values()).filter(
    (r) => !q || r.student_name.toLowerCase().includes(q) || r.student_id.toLowerCase().includes(q)
  );
}

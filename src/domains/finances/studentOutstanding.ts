import { Package } from '../packages/packageTypes';
import { Payment } from '../payments/paymentTypes';

export interface StudentCurrencyOutstanding {
  currency: string;
  totalPayable: number;
  totalPaid: number;
  outstanding: number;
  availableCredit: number;
  isReliable: boolean;
}

export interface OutstandingPackageInput {
  student_id?: string;
  package_price?: number | string;
  price?: number | string;
  currency?: string;
  status?: string;
  package_status?: string;
}

export interface OutstandingPaymentInput {
  student_id?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  payment_status?: string;
}

export function calculateStudentOutstanding(
  packages: Array<Package | OutstandingPackageInput>,
  payments: Array<Payment | OutstandingPaymentInput>,
  studentId: string
): StudentCurrencyOutstanding[] {
  if (!studentId) return [];

  const studentPkgs = packages.filter((p) => {
    if (String(p.student_id || '').trim() !== studentId) return false;
    const st = String(p.status || p.package_status || '').trim().toUpperCase();
    return st !== 'VOID' && st !== 'CANCELLED';
  });

  const studentPays = payments.filter((p) => {
    if (String(p.student_id || '').trim() !== studentId) return false;
    const st = String(p.status || p.payment_status || '').trim().toUpperCase();
    return st !== 'VOID' && st !== 'CANCELLED';
  });

  const currencies = new Set<string>();
  for (const pkg of studentPkgs) {
    if (pkg.currency) currencies.add(String(pkg.currency).trim().toUpperCase());
  }
  for (const pay of studentPays) {
    if (pay.currency) currencies.add(String(pay.currency).trim().toUpperCase());
  }

  if (currencies.size === 0) return [];

  const sortedCurrencies = Array.from(currencies).sort();
  const balances: StudentCurrencyOutstanding[] = [];

  for (const cur of sortedCurrencies) {
    let totalPayable = 0;
    let totalPaid = 0;
    let isReliable = true;

    for (const pkg of studentPkgs) {
      const pkgCur = String(pkg.currency || 'INR').trim().toUpperCase();
      if (pkgCur === cur) {
        const rawVal = pkg.package_price !== undefined && pkg.package_price !== null && pkg.package_price !== ''
          ? pkg.package_price
          : pkg.price;
        const numVal = Number(rawVal);
        if (rawVal === undefined || rawVal === null || isNaN(numVal)) {
          isReliable = false;
        } else {
          totalPayable += numVal;
        }
      }
    }

    for (const pay of studentPays) {
      const payCur = String(pay.currency || 'INR').trim().toUpperCase();
      if (payCur === cur) {
        const rawAmt = pay.amount;
        const numAmt = Number(rawAmt);
        if (rawAmt === undefined || rawAmt === null || isNaN(numAmt)) {
          isReliable = false;
        } else {
          totalPaid += numAmt;
        }
      }
    }

    totalPayable = Math.round(totalPayable * 100) / 100;
    totalPaid = Math.round(totalPaid * 100) / 100;
    const diff = Math.round((totalPayable - totalPaid) * 100) / 100;

    balances.push({
      currency: cur,
      totalPayable,
      totalPaid,
      outstanding: Math.max(0, diff),
      availableCredit: Math.max(0, -diff),
      isReliable,
    });
  }

  return balances;
}

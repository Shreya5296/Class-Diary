export interface CurrencyFinancialBalance {
  currency: string;
  totalPayable: number;
  totalPaid: number;
  outstanding: number;
  availableCredit: number;
  isReliable: boolean;
}

export interface StudentFinancialEntityPackage {
  student_id?: string;
  package_price?: number | string;
  price?: number | string;
  currency?: string;
  status?: string;
}

export interface StudentFinancialEntityPayment {
  student_id?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  payment_status?: string;
}

/**
 * Confirmed Accounting Rule:
 * Outstanding Amount = Total Package Amount Payable − Total Recorded Payments Received.
 * Calculated separately for each currency across all historical and current packages.
 */
export function calculateStudentFinancialBalances(
  packages: StudentFinancialEntityPackage[],
  payments: StudentFinancialEntityPayment[],
  studentId: string
): CurrencyFinancialBalance[] {
  if (!studentId) return [];

  const studentPkgs = packages.filter((p) => String(p.student_id || '').trim() === studentId);
  // Physical Payments table has exactly 6 columns (no status column).
  // Voided payments are deleted from the sheet on voiding; all recorded payment rows for the student are included.
  const studentPays = payments.filter((p) => String(p.student_id || '').trim() === studentId);

  const currencies = new Set<string>();
  for (const pkg of studentPkgs) {
    if (pkg.currency) currencies.add(String(pkg.currency).trim().toUpperCase());
  }
  for (const pay of studentPays) {
    if (pay.currency) currencies.add(String(pay.currency).trim().toUpperCase());
  }

  if (currencies.size === 0) return [];

  const sortedCurrencies = Array.from(currencies).sort();
  const balances: CurrencyFinancialBalance[] = [];

  for (const cur of sortedCurrencies) {
    let totalPayable = 0;
    let totalPaid = 0;
    let isReliable = true;

    for (const pkg of studentPkgs) {
      const pkgCur = String(pkg.currency || 'INR').trim().toUpperCase();
      if (pkgCur === cur) {
        const rawVal = pkg.package_price !== undefined && pkg.package_price !== ''
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

    const outstanding = Math.max(0, diff);
    const availableCredit = Math.max(0, -diff);

    balances.push({
      currency: cur,
      totalPayable,
      totalPaid,
      outstanding,
      availableCredit,
      isReliable,
    });
  }

  return balances;
}

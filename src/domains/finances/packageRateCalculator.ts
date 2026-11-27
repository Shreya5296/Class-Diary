import { Package } from '../packages/packageTypes';
import { Payment } from '../payments/paymentTypes';
import { getCurrencySymbol } from '../../lib/userPreferences';
import { getPackageTotalClasses } from '../packages/packagePlanCalculations';

export interface StudentPerClassRateResult {
  hasRate: boolean;
  inrDisplay: string | null;
  localDisplay: string | null;
  localCurrency?: string;
  inrRate?: number;
  localRate?: number;
}

export function formatRateWithCurrency(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${symbol}${formatted} / class`;
}

export function calculateStudentPerClassRate(
  studentId: string,
  packages: Package[],
  payments: Payment[] = []
): StudentPerClassRateResult {
  if (!studentId) return { hasRate: false, inrDisplay: null, localDisplay: null };

  const studentPkgs = packages.filter((p) => p.student_id === studentId);
  if (studentPkgs.length === 0) {
    return { hasRate: false, inrDisplay: null, localDisplay: null };
  }

  const pkg =
    studentPkgs.find((p) => p.status === 'ACTIVE') ||
    studentPkgs.slice().sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')))[0];

  if (!pkg) return { hasRate: false, inrDisplay: null, localDisplay: null };

  const rawPrice = pkg.package_price !== undefined && pkg.package_price !== null ? pkg.package_price : pkg.price;
  const price = Number(rawPrice);
  const count = getPackageTotalClasses(pkg);

  if (isNaN(price) || isNaN(count) || price <= 0 || count <= 0) {
    return { hasRate: false, inrDisplay: null, localDisplay: null };
  }

  const baseRate = Math.round((price / count) * 100) / 100;
  const pkgCurrency = (pkg.currency || 'INR').trim().toUpperCase();

  const studentPayments = payments.filter((p) => p.student_id === studentId && p.status !== 'VOID' && p.status !== 'VOIDED');
  const foreignPayment = studentPayments.find((p) => (p.currency || 'INR').toUpperCase() !== 'INR');
  const foreignPkg = studentPkgs.find((p) => (p.currency || 'INR').toUpperCase() !== 'INR');
  const studentLocalCurrency = foreignPkg?.currency?.toUpperCase() || foreignPayment?.currency?.toUpperCase() || (pkgCurrency !== 'INR' ? pkgCurrency : 'INR');

  const targetForeignCur = pkgCurrency !== 'INR' ? pkgCurrency : studentLocalCurrency !== 'INR' ? studentLocalCurrency : null;

  let exchangeRate: number | null = null;
  if (targetForeignCur) {
    const matchingPay = studentPayments.find(
      (p) => (p.currency || '').toUpperCase() === targetForeignCur && Number(p.in_inr) > 0 && Number(p.amount) > 0
    );
    if (matchingPay) {
      exchangeRate = Number(matchingPay.in_inr) / Number(matchingPay.amount);
    }
  }

  if (pkgCurrency === 'INR') {
    const inrRate = baseRate;
    const inrDisplay = formatRateWithCurrency(inrRate, 'INR');

    if (studentLocalCurrency && studentLocalCurrency !== 'INR') {
      if (exchangeRate && exchangeRate > 0) {
        const localRate = Math.round((inrRate / exchangeRate) * 100) / 100;
        return {
          hasRate: true,
          inrDisplay,
          localDisplay: formatRateWithCurrency(localRate, studentLocalCurrency),
          localCurrency: studentLocalCurrency,
          inrRate,
          localRate,
        };
      }
      return {
        hasRate: true,
        inrDisplay,
        localDisplay: '—',
        localCurrency: studentLocalCurrency,
        inrRate,
      };
    }

    return {
      hasRate: true,
      inrDisplay,
      localDisplay: null,
      localCurrency: 'INR',
      inrRate,
    };
  }

  const localRate = baseRate;
  const localDisplay = formatRateWithCurrency(localRate, pkgCurrency);

  if (exchangeRate && exchangeRate > 0) {
    const inrRate = Math.round(localRate * exchangeRate * 100) / 100;
    return {
      hasRate: true,
      inrDisplay: formatRateWithCurrency(inrRate, 'INR'),
      localDisplay,
      localCurrency: pkgCurrency,
      inrRate,
      localRate,
    };
  }

  return {
    hasRate: true,
    inrDisplay: '—',
    localDisplay,
    localCurrency: pkgCurrency,
    localRate,
  };
}

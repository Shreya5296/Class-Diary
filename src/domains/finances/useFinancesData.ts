import { useState, useEffect, useMemo, useCallback } from 'react';
import { FinancialSummary, FinanceFilter, StudentFinancialRecord, CurrencyTotals } from './financeTypes';
import { Payment } from '../payments/paymentTypes';
import { Package } from '../packages/packageTypes';
import { fetchFinancialSummary } from '../reports/reportApi';
import { fetchPayments } from '../payments/paymentApi';
import { fetchPackages } from '../packages/packageApi';
import { sortPaymentsByDateDescending } from './financeSorting';

export function useFinancesData(token?: string | null) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FinanceFilter>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, payList, pkgList] = await Promise.all([
        fetchFinancialSummary(token, { startDate: filter.startDate, endDate: filter.endDate }).catch(() => null),
        fetchPayments(undefined, undefined, token).catch(() => []),
        fetchPackages(undefined, token).catch(() => []),
      ]);
      setSummary(sum);
      setPayments(payList);
      setPackages(pkgList);
    } finally {
      setLoading(false);
    }
  }, [token, filter.startDate, filter.endDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const currencyTotals = useMemo(() => {
    const packagesByCurrency: CurrencyTotals = {};
    for (const pkg of packages) {
      const cur = (pkg.currency || 'INR').trim().toUpperCase();
      const price = Number(pkg.package_price || pkg.price || 0);
      if (price > 0) packagesByCurrency[cur] = (packagesByCurrency[cur] || 0) + price;
    }

    const paymentsByCurrency: CurrencyTotals = {};
    let totalRecordedInr = 0;
    for (const p of payments) {
      const cur = (p.currency || 'INR').trim().toUpperCase();
      const amt = Number(p.amount || 0);
      if (amt > 0) paymentsByCurrency[cur] = (paymentsByCurrency[cur] || 0) + amt;
      if (cur === 'INR') {
        totalRecordedInr += amt;
      } else if (p.in_inr && Number(p.in_inr) > 0) {
        totalRecordedInr += Number(p.in_inr);
      }
    }
    return { packagesByCurrency, paymentsByCurrency, totalRecordedInr };
  }, [packages, payments]);

  const filteredPayments = useMemo(() => {
    const q = (filter.search || '').trim().toLowerCase();
    const start = filter.startDate;
    const end = filter.endDate;

    const filtered = payments.filter((p) => {
      const pDate = p.payment_date ? String(p.payment_date).slice(0, 10) : '';
      if (start && pDate && pDate < start) return false;
      if (end && pDate && pDate > end) return false;
      if (q) {
        const name = (p.student_name || '').toLowerCase();
        const sid = (p.student_id || '').toLowerCase();
        return name.includes(q) || sid.includes(q);
      }
      return true;
    });

    return sortPaymentsByDateDescending(filtered);
  }, [payments, filter]);

  const studentBalances = useMemo<StudentFinancialRecord[]>(() => {
    const map = new Map<string, StudentFinancialRecord>();

    for (const pkg of packages) {
      const sid = pkg.student_id || '_unknown_';
      const name = pkg.student_name || sid;
      const cur = (pkg.currency || 'INR').trim().toUpperCase();
      const price = Number(pkg.package_price || pkg.price || 0);
      const existing = map.get(sid) || {
        student_id: sid, student_name: name,
        packageTotalsByCurrency: {}, paymentTotalsByCurrency: {},
        paymentCount: 0,
      };
      existing.packageTotalsByCurrency[cur] = (existing.packageTotalsByCurrency[cur] || 0) + price;
      map.set(sid, existing);
    }

    for (const p of payments) {
      const sid = p.student_id || '_unknown_';
      const name = p.student_name || sid;
      const cur = (p.currency || 'INR').trim().toUpperCase();
      const amt = Number(p.amount || 0);
      const existing = map.get(sid) || {
        student_id: sid, student_name: name,
        packageTotalsByCurrency: {}, paymentTotalsByCurrency: {},
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

    const q = (filter.search || '').trim().toLowerCase();
    return Array.from(map.values()).filter(
      (r) => !q || r.student_name.toLowerCase().includes(q) || r.student_id.toLowerCase().includes(q)
    );
  }, [packages, payments, filter.search]);

  return {
    summary,
    packages,
    filteredPayments,
    studentBalances,
    currencyTotals,
    loading,
    filter,
    setFilter,
    refresh: loadData,
  };
}

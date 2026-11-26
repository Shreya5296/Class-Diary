import { useState, useEffect, useMemo, useCallback } from 'react';
import { FinanceFilter, CurrencyTotals } from './financeTypes';
import { Payment } from '../payments/paymentTypes';
import { Package } from '../packages/packageTypes';
import { sortPaymentsByDateDescending } from './financeSorting';
import { toInputDateFormat } from '../../lib/dateFormat';
import { getSavedTimezone } from '../../lib/userPreferences';
import { useAppData } from '../../context/AppDataContext';
import { fetchFinancesCombined, FinancesCombinedData } from '../../api/combinedApi';
import { buildStudentFinancialRecords } from './studentBalanceCalculator';

export function useFinancesData(token?: string | null) {
  const activeTz = getSavedTimezone() || 'Asia/Kolkata';
  const currentMonthDefault = useMemo(() => toInputDateFormat(new Date(), activeTz).slice(0, 7), [activeTz]);

  let ctx: ReturnType<typeof useAppData> | null = null;
  try {
    ctx = useAppData();
  } catch {
    ctx = null;
  }

  const [localData, setLocalData] = useState<FinancesCombinedData | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [filter, setFilter] = useState<FinanceFilter>(() => ({
    selectedMonth: currentMonthDefault,
  }));

  const loadData = useCallback(async (force = false) => {
    const params = { startDate: filter.startDate, endDate: filter.endDate };
    if (ctx) {
      await ctx.getFinances(token, params, force);
    } else {
      setLocalLoading(true);
      try {
        const d = await fetchFinancesCombined(token, params);
        setLocalData(d);
      } catch {
        // gracefully handle
      } finally {
        setLocalLoading(false);
      }
    }
  }, [ctx, token, filter.startDate, filter.endDate]);

  useEffect(() => { loadData(false); }, [loadData]);

  const data = ctx ? ctx.financesData : localData;
  const loading = ctx ? (!ctx.financesData && ctx.financesLoading) : localLoading;
  const summary = data?.summary || null;
  const payments: Payment[] = data?.payments || [];
  const packages: Package[] = data?.packages || [];

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
    const targetMonth = filter.selectedMonth;

    const filtered = payments.filter((p) => {
      const pDate = p.payment_date ? String(p.payment_date).slice(0, 10) : '';
      if (targetMonth && (!pDate || !pDate.startsWith(targetMonth))) return false;
      if (q) {
        const name = (p.student_name || '').toLowerCase();
        const sid = (p.student_id || '').toLowerCase();
        return name.includes(q) || sid.includes(q);
      }
      return true;
    });

    return sortPaymentsByDateDescending(filtered);
  }, [payments, filter]);

  const studentBalances = useMemo(() => {
    return buildStudentFinancialRecords(packages, payments, filter.search);
  }, [packages, payments, filter.search]);

  return {
    summary,
    packages,
    payments,
    filteredPayments,
    studentBalances,
    currencyTotals,
    loading,
    filter,
    setFilter,
    refresh: () => loadData(true),
  };
}

import { useState, useEffect, useCallback } from 'react';
import { Package } from '../packages/packageTypes';
import { fetchPackages } from '../packages/packageApi';
import { Payment } from '../payments/paymentTypes';
import { fetchPayments } from '../payments/paymentApi';
import { fetchClasses } from '../classes/classApi';
import { ClassSession } from '../classes/classTypes';
import { WeeklyScheduleEntry } from '../classes/scheduleApi';
import { parseCanonicalScheduleString } from './scheduleFormatter';
import { getLatestCompletedClassDate } from './studentStatusClassifier';
import { calculateStudentFinancialBalances, CurrencyFinancialBalance } from '../finances/studentFinancialAccounting';

export interface StudentFinancialInfo {
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  availableCredit?: number;
  currency: string;
  inInr?: number;
  currencyBalances?: CurrencyFinancialBalance[];
}

export function useStudentAggregates(studentIds: string[], token?: string | null) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [schedulesMap, setSchedulesMap] = useState<Record<string, WeeklyScheduleEntry[]>>({});
  const [loading, setLoading] = useState(true);

  const buildMap = useCallback((pkgs: Package[], ids: string[]) => {
    const sids = ids.length > 0 ? ids : Array.from(new Set(pkgs.map((p) => p.student_id)));
    const map: Record<string, WeeklyScheduleEntry[]> = {};
    for (const sid of sids) {
      const studentPkgs = pkgs
        .filter((p) => p.student_id === sid)
        .sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')));
      const activePkg =
        studentPkgs.find((p) => p.status === 'ACTIVE' && Boolean(p.class_schedule)) ||
        studentPkgs.find((p) => Boolean(p.class_schedule)) ||
        studentPkgs[0];
      map[sid] = activePkg?.class_schedule
        ? parseCanonicalScheduleString(activePkg.class_schedule, Number(activePkg.class_duration) || 60)
        : [];
    }
    return map;
  }, []);

  const loadAggregates = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgs, pays, cls] = await Promise.all([
        fetchPackages(undefined, token).catch(() => []),
        fetchPayments(undefined, undefined, token).catch(() => []),
        fetchClasses(undefined, token).catch(() => []),
      ]);
      setPackages(pkgs);
      setPayments(pays);
      setClasses(cls);
      setSchedulesMap(buildMap(pkgs, studentIds));
    } finally {
      setLoading(false);
    }
  }, [token, JSON.stringify(studentIds), buildMap]);

  useEffect(() => {
    loadAggregates();
  }, [token]);

  useEffect(() => {
    if (packages.length > 0 && studentIds.length > 0) {
      setSchedulesMap(buildMap(packages, studentIds));
    }
  }, [JSON.stringify(studentIds), packages, buildMap]);

  const getStudentBalance = (sid: string) => {
    const studentPkgs = packages.filter((p) => p.student_id === sid);
    let totalPurchased = 0;
    let totalConsumed = 0;
    for (const p of studentPkgs) {
      totalPurchased += Number(p.classes_purchased !== undefined ? p.classes_purchased : p.total_classes) || 0;
      totalConsumed += Number(p.consumed_classes !== undefined ? p.consumed_classes : p.classes_consumed) || 0;
    }
    return { totalPurchased, totalConsumed, packages: studentPkgs };
  };

  const getStudentLastCompletedDate = (sid: string): string | null => getLatestCompletedClassDate(classes, sid);
  const getStudentSchedule = (sid: string): WeeklyScheduleEntry[] => schedulesMap[sid] || [];
  const getStudentMeetingLink = (_sid: string): any => undefined;

  const getStudentFinancials = (sid: string): StudentFinancialInfo => {
    const currencyBalances = calculateStudentFinancialBalances(packages, payments, sid);
    const primary = currencyBalances[0] || { currency: 'INR', totalPayable: 0, totalPaid: 0, outstanding: 0, availableCredit: 0 };
    let totalInInr = 0;
    const studentPays = payments.filter((p) => p.student_id === sid && p.status !== 'VOIDED' && p.payment_status !== 'VOIDED');
    for (const pay of studentPays) {
      if (pay.in_inr) totalInInr += Number(pay.in_inr);
    }
    return {
      totalInvoiced: primary.totalPayable, totalPaid: primary.totalPaid, outstanding: primary.outstanding,
      availableCredit: primary.availableCredit, currency: primary.currency, inInr: totalInInr > 0 ? totalInInr : undefined,
      currencyBalances,
    };
  };

  return {
    packages, payments, classes, loading,
    refetch: loadAggregates, getStudentBalance, getStudentLastCompletedDate,
    getStudentSchedule, getStudentMeetingLink, getStudentFinancials,
  };
}

import { useState, useEffect } from 'react';
import { Student } from '../students/studentTypes';
import { Package } from './packageTypes';
import { RenewalFormData, RenewalStudentSummary, isSessionCreditConsumed } from './packageRenewalTypes';
import { fetchPackages } from './packageApi';
import { fetchClasses } from '../classes/classApi';
import { fetchPayments } from '../payments/paymentApi';
import { parseCanonicalScheduleString } from '../students/scheduleFormatter';

export function resolveLatestActivePackage(packages: Package[]): Package | null {
  const activePkgs = packages.filter((p) => {
    const st = String(p.status || (p as any).package_status || '').trim().toUpperCase();
    return st !== 'VOID' && st !== 'CANCELLED';
  });
  if (activePkgs.length === 0) return null;

  const activeStatusPkgs = activePkgs.filter((p) => String(p.status).trim().toUpperCase() === 'ACTIVE');
  const pool = activeStatusPkgs.length > 0 ? activeStatusPkgs : activePkgs;

  return pool.slice().sort((a, b) => {
    const dateA = a.start_date || '';
    const dateB = b.start_date || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return String(b.package_id || '').localeCompare(String(a.package_id || ''));
  })[0];
}

export function resolveRenewalPlanType(pkg?: Package | null, fallback = 'Per Class'): string {
  if (!pkg?.plan_type && !pkg?.package_name) return fallback;
  const raw = String(pkg.plan_type || pkg.package_name || '').trim();
  const upper = raw.toUpperCase();
  if (upper.includes('PACKAGE') || upper.includes('BLOCK')) return 'Package';
  if (upper.includes('PER CLASS') || upper.includes('PER_CLASS')) return 'Per Class';
  if (upper.includes('HOURLY')) return 'Hourly';
  if (upper.includes('YEARLY') || upper.includes('ANNUAL')) return 'Yearly';
  return raw;
}

export function useStudentRenewalForm(initialStudent: Student | null | undefined, token?: string | null) {
  const [student, setStudent] = useState<Student | null>(initialStudent || null);
  const [step, setStep] = useState<number>(initialStudent ? 2 : 1);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summary, setSummary] = useState<RenewalStudentSummary | null>(null);

  const [formData, setFormData] = useState<RenewalFormData>({
    student: initialStudent || null,
    new_classes_purchased: '12',
    plan_type: 'Per Class',
    currency: 'INR',
    per_class: '',
    package_price: '',
    class_duration: '60',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    next_due_date: '',
    schedules: [],
    payment: {
      record_payment: true,
      amount: '',
      currency: 'INR',
      in_inr: '',
      payment_date: new Date().toISOString().slice(0, 10),
    },
    confirmed: false,
  });

  useEffect(() => {
    if (!student) return;
    let active = true;
    setLoadingSummary(true);
    Promise.all([
      fetchPackages(student.student_id, token).catch(() => []),
      fetchClasses(student.student_id, token).catch(() => []),
      fetchPayments(student.student_id, undefined, token).catch(() => []),
    ]).then(([pkgs, cls, pays]) => {
      if (!active) return;
      const exPkg = resolveLatestActivePackage(pkgs);
      let consumed = 0;
      for (const c of cls) {
        if (c.student_id === student.student_id && isSessionCreditConsumed(c)) {
          consumed++;
        }
      }
      const purchased = Number(exPkg ? (exPkg.classes_purchased || exPkg.total_classes || 0) : 0);
      const cur = exPkg?.currency || 'INR';
      const dur = String(exPkg?.class_duration || '60');
      const rate = exPkg?.per_class ? String(exPkg.per_class) : '';
      const scheds = exPkg?.class_schedule
        ? parseCanonicalScheduleString(exPkg.class_schedule, Number(dur) || 60)
        : [];
      const planType = resolveRenewalPlanType(exPkg, 'Per Class');

      setSummary({
        student, package: exPkg, cumulativePurchased: purchased,
        cumulativeConsumed: consumed, availableBalance: Math.max(0, purchased - consumed),
        payments: pays, schedules: scheds,
      });

      setFormData((prev) => ({
        ...prev, student, currency: cur, class_duration: dur, per_class: rate,
        plan_type: planType, schedules: scheds.length > 0 ? scheds : prev.schedules,
        payment: { ...prev.payment, currency: cur },
      }));
      setLoadingSummary(false);
    });
    return () => { active = false; };
  }, [student?.student_id, token]);

  const selectStudent = (s: Student) => {
    setStudent(s);
    setFormData((prev) => ({ ...prev, student: s }));
    setStep(2);
  };

  return {
    student, selectStudent, step, setStep, loadingSummary,
    summary, formData, setFormData,
  };
}

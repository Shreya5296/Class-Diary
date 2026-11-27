import { Package } from './packageTypes';
import { isYearlyPackage, calculateYearlyOccurrencesCount } from './yearlyPackageCalculations';
import { parseCanonicalScheduleString } from '../students/scheduleFormatter';
import { WeeklyScheduleEntry } from '../classes/scheduleApi';

export interface PackagePlanDetails {
  isYearly: boolean;
  totalClasses: number;
  ratePerClass: number;
  totalClassesLabel: string;
  rateLabel: string;
}

export function getPackageTotalClasses(
  pkg?: Partial<Package> | null,
  schedules?: WeeklyScheduleEntry[] | null
): number {
  if (!pkg) return 0;
  const isYearly = isYearlyPackage(pkg.plan_type || pkg.package_name);
  if (isYearly && pkg.start_date && (pkg.end_date || pkg.expiry_date)) {
    const sDt = String(pkg.start_date).slice(0, 10);
    const eDt = String(pkg.end_date || pkg.expiry_date).slice(0, 10);
    const scheds = (schedules && schedules.length > 0)
      ? schedules
      : (pkg.schedules && pkg.schedules.length > 0)
      ? (pkg.schedules as WeeklyScheduleEntry[])
      : parseCanonicalScheduleString(pkg.class_schedule, Number(pkg.class_duration) || 60);

    if (scheds.length > 0) {
      const yearlyCount = calculateYearlyOccurrencesCount(sDt, eDt, scheds);
      if (yearlyCount > 0) return yearlyCount;
    }
  }

  const raw = pkg.classes_purchased !== undefined && pkg.classes_purchased !== null
    ? pkg.classes_purchased
    : (pkg.total_classes !== undefined && pkg.total_classes !== null ? pkg.total_classes : (pkg as any).purchased_classes);
  return Number(raw) || 0;
}

export function getPackagePerClassRate(
  pkg?: Partial<Package> | null,
  schedules?: WeeklyScheduleEntry[] | null
): number {
  if (!pkg) return 0;
  const rawPrice = pkg.package_price !== undefined && pkg.package_price !== null && (pkg.package_price as unknown) !== ''
    ? pkg.package_price
    : pkg.price;
  const price = Number(rawPrice);
  if (isNaN(price) || price <= 0) return 0;

  const totalClasses = getPackageTotalClasses(pkg, schedules);
  if (totalClasses <= 0) return 0;

  return Math.round((price / totalClasses) * 100) / 100;
}

export function getPackagePlanDetails(
  pkg?: Partial<Package> | null,
  schedules?: WeeklyScheduleEntry[] | null
): PackagePlanDetails {
  const isYearly = isYearlyPackage(pkg?.plan_type || pkg?.package_name);
  const totalClasses = getPackageTotalClasses(pkg, schedules);
  const ratePerClass = getPackagePerClassRate(pkg, schedules);

  return {
    isYearly,
    totalClasses,
    ratePerClass,
    totalClassesLabel: isYearly ? 'Total classes in plan' : 'Total Classes',
    rateLabel: 'Rate per class',
  };
}

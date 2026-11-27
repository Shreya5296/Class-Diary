import { sendApiRequest, onCapabilityVersion } from './apiClient';
import { ApiClientError } from './apiErrors';
import { getRuntimeConfig } from '../config/runtimeConfig';
import { DashboardOverviewData } from '../domains/dashboard/dashboardTypes';
import { ClassSession } from '../domains/classes/classTypes';
import { WeeklyScheduleEntry } from '../domains/classes/scheduleApi';
import { Student } from '../domains/students/studentTypes';
import { Package } from '../domains/packages/packageTypes';
import { FinancialSummary } from '../domains/finances/financeTypes';
import { Payment } from '../domains/payments/paymentTypes';
import { fetchDashboardOverview } from '../domains/dashboard/dashboardApi';
import { fetchClasses } from '../domains/classes/classApi';
import { fetchStudents } from '../domains/students/studentApi';
import { fetchPackages } from '../domains/packages/packageApi';
import { fetchFinancialSummary } from '../domains/reports/reportApi';
import { fetchPayments } from '../domains/payments/paymentApi';

export interface DashboardCombinedData {
  overview: DashboardOverviewData;
  classes: ClassSession[];
  schedules: WeeklyScheduleEntry[];
  students: Student[];
  packages: Package[];
  payments?: Payment[];
  fees: any[];
}

export interface FinancesCombinedData {
  summary: FinancialSummary;
  payments: Payment[];
  packages: Package[];
}

export const DEFAULT_CAPABILITY_VERSION = 'v2.1';
let currentVersion = DEFAULT_CAPABILITY_VERSION;
const unsupportedOps = new Set<string>();

export const getCapabilityStorageKey = (): string => {
  const cfg = getRuntimeConfig();
  const hash = cfg.appsScriptUrl ? btoa(cfg.appsScriptUrl).slice(-10) : 'default';
  return `smd_caps_${hash}`;
};

export function loadCapabilities(): void {
  unsupportedOps.clear();
  try {
    if (typeof sessionStorage === 'undefined') return;
    const raw = sessionStorage.getItem(getCapabilityStorageKey());
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data?.version === currentVersion && Array.isArray(data.unsupported)) {
      data.unsupported.forEach((op: string) => unsupportedOps.add(op));
    } else {
      sessionStorage.removeItem(getCapabilityStorageKey());
    }
  } catch {}
}

export const getBackendCapabilityVersion = (): string => currentVersion;
export function setBackendCapabilityVersion(version: string): void {
  if (version && version !== currentVersion) {
    currentVersion = version;
    loadCapabilities();
onCapabilityVersion((version: string) => {
  setBackendCapabilityVersion(version);
});
  }
}

export const isOperationSupported = (op: string): boolean => !unsupportedOps.has(op);
export function resetApiCapabilities(): void {
  unsupportedOps.clear();
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(getCapabilityStorageKey());
  } catch {}
}

function markUnsupported(op: string): void {
  unsupportedOps.add(op);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(getCapabilityStorageKey(), JSON.stringify({ version: currentVersion, unsupported: Array.from(unsupportedOps) }));
    }
  } catch {}
}

loadCapabilities();
onCapabilityVersion((version: string) => {
  setBackendCapabilityVersion(version);
});

async function fetchDashboardFallback(token?: string | null): Promise<DashboardCombinedData> {
  const [ov, cls, stu, pkg, pay] = await Promise.all([
    fetchDashboardOverview(token),
    fetchClasses(undefined, token).catch(() => []),
    fetchStudents({}, token).catch(() => []),
    fetchPackages(undefined, token).catch(() => []),
    fetchPayments(undefined, undefined, token).catch(() => []),
  ]);
  return { overview: ov, classes: cls, schedules: [], students: stu, packages: pkg, payments: pay, fees: [] };
}

export async function fetchDashboardCombined(token?: string | null): Promise<DashboardCombinedData> {
  if (unsupportedOps.has('dashboard.combined')) return fetchDashboardFallback(token);
  try {
    const res = await sendApiRequest<DashboardCombinedData>('dashboard.combined', {}, { token });
    if (res.ok && res.data) return res.data;
  } catch (err: unknown) {
    if (err instanceof ApiClientError && (err.code === 'UNKNOWN_OPERATION' || err.message?.includes('Unknown operation'))) {
      markUnsupported('dashboard.combined');
      return fetchDashboardFallback(token);
    }
    throw err;
  }
  throw new Error('Failed to fetch dashboard data');
}

async function fetchFinancesFallback(token?: string | null, params: { startDate?: string; endDate?: string } = {}): Promise<FinancesCombinedData> {
  const [sum, pay, pkg] = await Promise.all([
    fetchFinancialSummary(token, params).catch(() => ({ totalInvoiced: 0, totalCollected: 0, totalOutstanding: 0, currency: 'INR' })),
    fetchPayments(undefined, undefined, token).catch(() => []),
    fetchPackages(undefined, token).catch(() => []),
  ]);
  return { summary: sum, payments: pay, packages: pkg };
}

export async function fetchFinancesCombined(token?: string | null, params: { startDate?: string; endDate?: string } = {}): Promise<FinancesCombinedData> {
  if (unsupportedOps.has('finances.combined')) return fetchFinancesFallback(token, params);
  try {
    const res = await sendApiRequest<FinancesCombinedData>('finances.combined', params as Record<string, unknown>, { token });
    if (res.ok && res.data) return res.data;
  } catch (err: unknown) {
    if (err instanceof ApiClientError && (err.code === 'UNKNOWN_OPERATION' || err.message?.includes('Unknown operation'))) {
      markUnsupported('finances.combined');
      return fetchFinancesFallback(token, params);
    }
    throw err;
  }
  throw new Error('Failed to fetch finances data');
}

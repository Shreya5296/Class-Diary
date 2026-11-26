import { sendApiRequest } from './apiClient';
import { DashboardOverviewData } from '../domains/dashboard/dashboardTypes';
import { ClassSession } from '../domains/classes/classTypes';
import { WeeklyScheduleEntry } from '../domains/classes/scheduleApi';
import { Student } from '../domains/students/studentTypes';
import { Package } from '../domains/packages/packageTypes';
import { FinancialSummary } from '../domains/finances/financeTypes';
import { Payment } from '../domains/payments/paymentTypes';

export interface DashboardCombinedData {
  overview: DashboardOverviewData;
  classes: ClassSession[];
  schedules: WeeklyScheduleEntry[];
  students: Student[];
  packages: Package[];
  fees: any[];
}

export interface FinancesCombinedData {
  summary: FinancialSummary;
  payments: Payment[];
  packages: Package[];
}

export async function fetchDashboardCombined(token?: string | null): Promise<DashboardCombinedData> {
  const response = await sendApiRequest<DashboardCombinedData>(
    'dashboard.combined',
    {},
    { token }
  );
  return response.data!;
}

export async function fetchFinancesCombined(
  token?: string | null,
  params: { startDate?: string; endDate?: string } = {}
): Promise<FinancesCombinedData> {
  const response = await sendApiRequest<FinancesCombinedData>(
    'finances.combined',
    params as Record<string, unknown>,
    { token }
  );
  return response.data!;
}

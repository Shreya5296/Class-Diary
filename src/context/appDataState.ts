import { DashboardCombinedData, FinancesCombinedData } from '../api/combinedApi';

export type AppDataScope = 'dashboard' | 'finances' | 'all';

export interface AppDataContextValue {
  dashboardData: DashboardCombinedData | null;
  financesData: FinancesCombinedData | null;
  dashboardLoading: boolean;
  financesLoading: boolean;
  dashboardError: string | null;
  financesError: string | null;
  getDashboard: (token?: string | null, force?: boolean) => Promise<DashboardCombinedData | null>;
  getFinances: (token?: string | null, params?: { startDate?: string; endDate?: string }, force?: boolean) => Promise<FinancesCombinedData | null>;
  invalidate: (scope?: AppDataScope) => void;
  updateDashboardCache: (updater: (prev: DashboardCombinedData | null) => DashboardCombinedData | null) => void;
  bootstrapDashboard: (data: DashboardCombinedData) => void;
}

let clearFn: (() => void) | null = null;
let invalidateFn: ((scope?: AppDataScope) => void) | null = null;

export function registerAppDataHandlers(
  onClear: () => void,
  onInvalidate: (scope?: AppDataScope) => void
): () => void {
  clearFn = onClear;
  invalidateFn = onInvalidate;
  return () => {
    clearFn = null;
    invalidateFn = null;
  };
}

export function clearAppDataStore(): void {
  if (clearFn) clearFn();
}

export function invalidateAppData(scope?: AppDataScope): void {
  if (invalidateFn) invalidateFn(scope);
}

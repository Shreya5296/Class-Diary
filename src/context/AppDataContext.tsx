import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AuthContext } from '../auth/AuthProvider';
import { DashboardCombinedData, FinancesCombinedData, fetchDashboardCombined, fetchFinancesCombined } from '../api/combinedApi';
import { AppDataContextValue, AppDataScope, registerAppDataHandlers, clearAppDataStore, invalidateAppData } from './appDataState';

export { clearAppDataStore, invalidateAppData };
export type { AppDataContextValue, AppDataScope };

const AppDataContext = createContext<AppDataContextValue | null>(null);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useContext(AuthContext);
  const currentToken = auth?.token ?? null;
  const currentUserId = auth?.user?.email || (currentToken ? 'active_user' : null);

  const [dashboardData, setDashboardData] = useState<DashboardCombinedData | null>(null);
  const [financesData, setFinancesData] = useState<FinancesCombinedData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [financesLoading, setFinancesLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [financesError, setFinancesError] = useState<string | null>(null);

  const authEpochRef = useRef(0);
  const dashInFlight = useRef<Promise<DashboardCombinedData | null> | null>(null);
  const finInFlight = useRef<Promise<FinancesCombinedData | null> | null>(null);

  const resetAllData = useCallback(() => {
    authEpochRef.current += 1;
    dashInFlight.current = null;
    finInFlight.current = null;
    setDashboardData(null);
    setFinancesData(null);
    setDashboardLoading(false);
    setFinancesLoading(false);
    setDashboardError(null);
    setFinancesError(null);
  }, []);

  useEffect(() => { resetAllData(); }, [currentUserId, resetAllData]);

  const invalidate = useCallback((scope?: AppDataScope) => {
    if (!scope || scope === 'all' || scope === 'dashboard') setDashboardData(null);
    if (!scope || scope === 'all' || scope === 'finances') setFinancesData(null);
  }, []);

  useEffect(() => registerAppDataHandlers(resetAllData, invalidate), [resetAllData, invalidate]);

  const getDashboard = useCallback(async (token?: string | null, force?: boolean) => {
    const activeToken = token ?? currentToken, reqEpoch = authEpochRef.current;
    if (dashboardData && !force) {
      if (!dashInFlight.current) {
        dashInFlight.current = fetchDashboardCombined(activeToken)
          .then((fresh) => { if (authEpochRef.current === reqEpoch && (activeToken || currentToken)) setDashboardData(fresh); return fresh; })
          .catch(() => null).finally(() => { dashInFlight.current = null; });
      }
      return dashboardData;
    }
    if (dashInFlight.current) return dashInFlight.current;
    setDashboardLoading(true); setDashboardError(null);
    dashInFlight.current = fetchDashboardCombined(activeToken)
      .then((data) => { if (authEpochRef.current === reqEpoch && (activeToken || currentToken)) setDashboardData(data); return data; })
      .catch((err) => { if (authEpochRef.current === reqEpoch) setDashboardError(err.message || 'Failed fetch'); return null; })
      .finally(() => { if (authEpochRef.current === reqEpoch) setDashboardLoading(false); dashInFlight.current = null; });
    return dashInFlight.current;
  }, [dashboardData, currentToken]);

  const getFinances = useCallback(async (token?: string | null, params: { startDate?: string; endDate?: string } = {}, force?: boolean) => {
    const activeToken = token ?? currentToken, reqEpoch = authEpochRef.current;
    if (financesData && !force) {
      if (!finInFlight.current) {
        finInFlight.current = fetchFinancesCombined(activeToken, params)
          .then((fresh) => { if (authEpochRef.current === reqEpoch && (activeToken || currentToken)) setFinancesData(fresh); return fresh; })
          .catch(() => null).finally(() => { finInFlight.current = null; });
      }
      return financesData;
    }
    if (finInFlight.current) return finInFlight.current;
    setFinancesLoading(true); setFinancesError(null);
    finInFlight.current = fetchFinancesCombined(activeToken, params)
      .then((data) => { if (authEpochRef.current === reqEpoch && (activeToken || currentToken)) setFinancesData(data); return data; })
      .catch((err) => { if (authEpochRef.current === reqEpoch) setFinancesError(err.message || 'Failed fetch'); return null; })
      .finally(() => { if (authEpochRef.current === reqEpoch) setFinancesLoading(false); finInFlight.current = null; });
    return finInFlight.current;
  }, [financesData, currentToken]);

  const updateDashboardCache = useCallback((updater: (prev: DashboardCombinedData | null) => DashboardCombinedData | null) => {
    setDashboardData(updater);
  }, []);

  return (
    <AppDataContext.Provider value={{
      dashboardData, financesData, dashboardLoading, financesLoading,
      dashboardError, financesError, getDashboard, getFinances, invalidate, updateDashboardCache,
    }}>
      {children}
    </AppDataContext.Provider>
  );
};

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider');
  return ctx;
}

export function useOptionalAppData(): AppDataContextValue | null {
  return useContext(AppDataContext);
}

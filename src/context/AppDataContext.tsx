import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { AuthContext } from '../auth/AuthProvider';
import { DashboardCombinedData, FinancesCombinedData, fetchDashboardCombined, fetchFinancesCombined, resetApiCapabilities } from '../api/combinedApi';
import { AppDataContextValue, AppDataScope, registerAppDataHandlers, clearAppDataStore, invalidateAppData } from './appDataState';

export { clearAppDataStore, invalidateAppData };
export type { AppDataContextValue, AppDataScope };
export const AppDataContext = createContext<AppDataContextValue | null>(null);

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
  const dashDataRef = useRef<DashboardCombinedData | null>(null);
  const finDataRef = useRef<FinancesCombinedData | null>(null);
  const tokenRef = useRef<string | null>(null);
  const dashFetchedAtRef = useRef(0);
  const prevUserIdRef = useRef(currentUserId);

  dashDataRef.current = dashboardData;
  finDataRef.current = financesData;
  tokenRef.current = currentToken;

  const resetAllData = useCallback(() => {
    authEpochRef.current += 1;
    dashInFlight.current = null;
    finInFlight.current = null;
    dashFetchedAtRef.current = 0;
    resetApiCapabilities();
    setDashboardData(null);
    setFinancesData(null);
    setDashboardLoading(false);
    setFinancesLoading(false);
    setDashboardError(null);
    setFinancesError(null);
  }, []);

  useEffect(() => {
    if (prevUserIdRef.current !== currentUserId) {
      const isLogin = !prevUserIdRef.current && currentUserId;
      prevUserIdRef.current = currentUserId;
      if (!isLogin) resetAllData();
    }
  }, [currentUserId, resetAllData]);

  const invalidate = useCallback((scope?: AppDataScope) => {
    if (!scope || scope === 'all' || scope === 'dashboard') { setDashboardData(null); dashFetchedAtRef.current = 0; }
    if (!scope || scope === 'all' || scope === 'finances') setFinancesData(null);
  }, []);

  const bootstrapDashboard = useCallback((data: DashboardCombinedData) => {
    dashDataRef.current = data;
    dashFetchedAtRef.current = Date.now();
    setDashboardData(data);
    setDashboardLoading(false);
    setDashboardError(null);
  }, []);

  useEffect(() => registerAppDataHandlers(resetAllData, invalidate), [resetAllData, invalidate]);

  const getDashboard = useCallback(async (token?: string | null, force?: boolean) => {
    const activeToken = token ?? tokenRef.current, reqEpoch = authEpochRef.current;
    if (dashDataRef.current && !force) {
      if (Date.now() - dashFetchedAtRef.current > 30000 && !dashInFlight.current) {
        dashInFlight.current = fetchDashboardCombined(activeToken).then((fresh) => {
          if (authEpochRef.current === reqEpoch) { setDashboardData(fresh); setDashboardError(null); dashFetchedAtRef.current = Date.now(); }
          return fresh;
        }).catch(() => null).finally(() => { dashInFlight.current = null; });
      }
      return dashDataRef.current;
    }
    if (dashInFlight.current) return dashInFlight.current;
    setDashboardLoading(true); setDashboardError(null);
    dashInFlight.current = fetchDashboardCombined(activeToken).then((data) => {
      if (authEpochRef.current === reqEpoch) { setDashboardData(data); setDashboardError(null); dashFetchedAtRef.current = Date.now(); }
      return data;
    }).catch((err) => {
      if (authEpochRef.current === reqEpoch) setDashboardError(err.message || 'Failed fetch');
      return null;
    }).finally(() => {
      if (authEpochRef.current === reqEpoch) setDashboardLoading(false);
      dashInFlight.current = null;
    });
    return dashInFlight.current;
  }, []);

  const getFinances = useCallback(async (token?: string | null, params: { startDate?: string; endDate?: string } = {}, force?: boolean) => {
    const activeToken = token ?? tokenRef.current, reqEpoch = authEpochRef.current;
    if (finDataRef.current && !force) {
      if (!finInFlight.current) {
        finInFlight.current = fetchFinancesCombined(activeToken, params).then((fresh) => {
          if (authEpochRef.current === reqEpoch) { setFinancesData(fresh); setFinancesError(null); }
          return fresh;
        }).catch(() => null).finally(() => { finInFlight.current = null; });
      }
      return finDataRef.current;
    }
    if (finInFlight.current) return finInFlight.current;
    setFinancesLoading(true); setFinancesError(null);
    finInFlight.current = fetchFinancesCombined(activeToken, params).then((data) => {
      if (authEpochRef.current === reqEpoch) { setFinancesData(data); setFinancesError(null); }
      return data;
    }).catch((err) => {
      if (authEpochRef.current === reqEpoch) setFinancesError(err.message || 'Failed fetch');
      return null;
    }).finally(() => {
      if (authEpochRef.current === reqEpoch) setFinancesLoading(false);
      finInFlight.current = null;
    });
    return finInFlight.current;
  }, []);

  const updateDashboardCache = useCallback((updater: (prev: DashboardCombinedData | null) => DashboardCombinedData | null) => {
    setDashboardData(updater);
  }, []);

  const contextValue = useMemo<AppDataContextValue>(() => ({
    dashboardData, financesData, dashboardLoading, financesLoading,
    dashboardError, financesError, getDashboard, getFinances, invalidate, updateDashboardCache, bootstrapDashboard,
  }), [
    dashboardData, financesData, dashboardLoading, financesLoading,
    dashboardError, financesError, getDashboard, getFinances, invalidate, updateDashboardCache, bootstrapDashboard,
  ]);

  return <AppDataContext.Provider value={contextValue}>{children}</AppDataContext.Provider>;
};

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider');
  return ctx;
}

export function useOptionalAppData(): AppDataContextValue | null {
  return useContext(AppDataContext);
}

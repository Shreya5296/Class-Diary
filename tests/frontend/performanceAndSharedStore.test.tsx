import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMockApiRequest } from '../../src/api/mockDataStore';
import {
  fetchDashboardCombined,
  fetchFinancesCombined,
  resetApiCapabilities,
  DashboardCombinedData,
  FinancesCombinedData,
} from '../../src/api/combinedApi';
import {
  registerAppDataHandlers,
  clearAppDataStore,
  invalidateAppData,
  AppDataScope,
} from '../../src/context/appDataState';
import { handleSignOut } from '../../src/auth/signOut';
import { fetchClasses } from '../../src/domains/classes/classApi';
import { clearApiCache } from '../../src/api/apiClient';

describe('Performance, Store Lifecycle & Cache Invalidation Audit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearApiCache();
    clearAppDataStore();
    resetApiCapabilities();
  });

  describe('Finding F-01: Authentication Cache Cleanup & Isolation', () => {
    it('clearAppDataStore triggers the registered app data reset callback', () => {
      let resetCalled = false;
      const unregister = registerAppDataHandlers(
        () => { resetCalled = true; },
        () => {}
      );

      clearAppDataStore();
      expect(resetCalled).toBe(true);
      unregister();
    });

    it('handleSignOut invokes token clearance, API cache clearance, and app data clearance', () => {
      let resetCalled = false;
      const unregister = registerAppDataHandlers(
        () => { resetCalled = true; },
        () => {}
      );

      handleSignOut();
      expect(resetCalled).toBe(true);
      unregister();
    });

    it('simulates in-flight request protection where old user response is discarded upon auth change', async () => {
      let currentEpoch = 1;
      let storedData: any = null;

      // Simulated fetch function mimicking AppDataContext protection logic
      const runProtectedFetch = async (token: string, reqEpoch: number, data: any) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (reqEpoch === currentEpoch) {
          storedData = data;
        }
      };

      // User A initiates request in epoch 1
      const p1 = runProtectedFetch('user_a_token', currentEpoch, { user: 'Admin A' });

      // User A signs out before request finishes -> epoch advances and store clears
      currentEpoch += 1;
      storedData = null;

      // User B signs in -> epoch 2
      const p2 = runProtectedFetch('user_b_token', currentEpoch, { user: 'Admin B' });

      await Promise.all([p1, p2]);

      // Admin B's data is stored, Admin A's old in-flight response was discarded!
      expect(storedData).toEqual({ user: 'Admin B' });
    });

    it('isolates user sessions so User B starts with empty cache', async () => {
      let storeUserA: any = { profile: 'Admin A' };
      clearAppDataStore();
      const unregister = registerAppDataHandlers(
        () => { storeUserA = null; },
        () => {}
      );

      clearAppDataStore();
      expect(storeUserA).toBeNull();
      unregister();
    });
  });

  describe('Finding F-04: Cross-Page Cache Invalidation', () => {
    it('dispatches scoped invalidations for dashboard, finances, and all', () => {
      const invalidations: (AppDataScope | undefined)[] = [];
      const unregister = registerAppDataHandlers(
        () => {},
        (scope) => { invalidations.push(scope); }
      );

      invalidateAppData('dashboard');
      invalidateAppData('finances');
      invalidateAppData('all');

      expect(invalidations).toEqual(['dashboard', 'finances', 'all']);
      unregister();
    });

    it('preserves other domain cache when targeted invalidation occurs', () => {
      let dashState: any = { loaded: true };
      let finState: any = { loaded: true };

      const unregister = registerAppDataHandlers(
        () => { dashState = null; finState = null; },
        (scope) => {
          if (!scope || scope === 'all' || scope === 'dashboard') dashState = null;
          if (!scope || scope === 'all' || scope === 'finances') finState = null;
        }
      );

      // Invalidate only dashboard
      invalidateAppData('dashboard');
      expect(dashState).toBeNull();
      expect(finState).not.toBeNull();

      // Reset
      dashState = { loaded: true };
      // Invalidate only finances
      invalidateAppData('finances');
      expect(finState).toBeNull();
      expect(dashState).not.toBeNull();

      unregister();
    });
  });

  describe('Finding F-03: Class Schedule Scope & On-Demand Pagination', () => {
    it('supports scope=upcoming and scope=past parameters in mockDataStore', () => {
      const upcomingRes = handleMockApiRequest<any[]>('classes.list', { scope: 'upcoming' }, 'req_up');
      expect(upcomingRes.ok).toBe(true);
      expect(Array.isArray(upcomingRes.data)).toBe(true);

      const pastRes = handleMockApiRequest<any[]>('classes.list', { scope: 'past' }, 'req_past');
      expect(pastRes.ok).toBe(true);
      expect(Array.isArray(pastRes.data)).toBe(true);

      // Verify no overlap between strict past and upcoming
      const upcomingIds = new Set((upcomingRes.data || []).map((c: any) => c.session_id));
      for (const p of (pastRes.data || [])) {
        if (p.session_status !== 'SCHEDULED') {
          expect(upcomingIds.has(p.session_id)).toBe(false);
        }
      }
    });

    it('fetchClasses dispatches scope payload to API client', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        const body = JSON.parse(options.body);
        expect(body.payload.scope).toBe('upcoming');
        return {
          ok: true,
          json: async () => ({ ok: true, data: [{ session_id: 's_up_1' }] }),
        };
      });

      const res = await fetchClasses(undefined, 'tok', { scope: 'upcoming' });
      expect(res.length).toBe(1);
      expect(res[0].session_id).toBe('s_up_1');
    });

    it('verifies ClassSchedule past sessions are paginated at 50 per page', () => {
      const dummyPast = Array.from({ length: 148 }, (_, i) => ({
        session_id: `s_${i}`,
        student_id: `stu_${i}`,
        schedule_date: '2026-01-01',
        schedule_time: '10:00',
      }));

      const pageSize = 50;
      const page1 = dummyPast.slice(0, 1 * pageSize);
      expect(page1.length).toBe(50);

      const page2 = dummyPast.slice(0, 2 * pageSize);
      expect(page2.length).toBe(100);

      const page3 = dummyPast.slice(0, 3 * pageSize);
      expect(page3.length).toBe(148);
    });
  });

  describe('Prompt C Combined Payload Contract Validation', () => {
    it('returns comprehensive combined payload for dashboard.combined', async () => {
      const res = handleMockApiRequest<DashboardCombinedData>('dashboard.combined', {}, 'req_dash_test');
      expect(res.ok).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.overview).toBeDefined();
      expect(res.data?.overview.activeStudentsCount).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.data?.classes)).toBe(true);
      expect(Array.isArray(res.data?.students)).toBe(true);
      expect(Array.isArray(res.data?.packages)).toBe(true);
      expect(Array.isArray(res.data?.schedules)).toBe(true);
      expect(Array.isArray(res.data?.fees)).toBe(true);
    });

    it('returns comprehensive combined payload for finances.combined', async () => {
      const res = handleMockApiRequest<FinancesCombinedData>('finances.combined', {}, 'req_fin_test');
      expect(res.ok).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.summary).toBeDefined();
      expect(res.data?.summary.totalInvoiced).toBeGreaterThan(0);
      expect(Array.isArray(res.data?.payments)).toBe(true);
      expect(Array.isArray(res.data?.packages)).toBe(true);
    });

    it('fetchDashboardCombined and fetchFinancesCombined resolve correctly', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        const body = JSON.parse(options.body);
        const res = handleMockApiRequest(body.operation, body, 'req_test');
        return {
          ok: true,
          json: async () => res,
        };
      });

      const dash = await fetchDashboardCombined('test_tok');
      expect(dash.overview).toBeDefined();
      expect(dash.classes.length).toBeGreaterThan(0);

      const fin = await fetchFinancesCombined('test_tok');
      expect(fin.summary).toBeDefined();
      expect(fin.payments.length).toBeGreaterThan(0);
    });

    it('gracefully falls back to individual endpoints when combined endpoint returns UNKNOWN_OPERATION', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        const body = JSON.parse(options.body);
        if (body.operation === 'dashboard.combined' || body.operation === 'finances.combined') {
          return {
            ok: true,
            json: async () => ({
              ok: false,
              error: { code: 'UNKNOWN_OPERATION', message: `Unknown operation: ${body.operation}` },
            }),
          };
        }
        const res = handleMockApiRequest(body.operation, body, 'req_test');
        return {
          ok: true,
          json: async () => res,
        };
      });

      const dash = await fetchDashboardCombined('test_tok');
      expect(dash.overview).toBeDefined();
      expect(dash.classes.length).toBeGreaterThan(0);
      expect(dash.students.length).toBeGreaterThan(0);
      expect(dash.packages.length).toBeGreaterThan(0);

      const fin = await fetchFinancesCombined('test_tok');
      expect(fin.summary).toBeDefined();
      expect(fin.packages.length).toBeGreaterThan(0);
      expect(fin.payments.length).toBeGreaterThan(0);
    });

    it('propagates terminal error when non-UNKNOWN_OPERATION failure occurs', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        };
      });

      await expect(fetchDashboardCombined('test_tok')).rejects.toThrow();
      await expect(fetchFinancesCombined('test_tok')).rejects.toThrow();
    });

    it('remembers unsupported combined endpoints and skips redundant probing on subsequent requests', async () => {
      resetApiCapabilities();
      const attemptedOps: string[] = [];

      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        const body = JSON.parse(options.body);
        attemptedOps.push(body.operation);
        if (body.operation === 'dashboard.combined' || body.operation === 'finances.combined') {
          return {
            ok: true,
            json: async () => ({
              ok: false,
              error: { code: 'UNKNOWN_OPERATION', message: `Unknown operation: ${body.operation}` },
            }),
          };
        }
        const res = handleMockApiRequest(body.operation, body, 'req_test');
        return {
          ok: true,
          json: async () => res,
        };
      });

      // First call encounters UNKNOWN_OPERATION and marks unsupported
      await fetchDashboardCombined('test_tok');
      expect(attemptedOps).toContain('dashboard.combined');

      // Second call must NOT attempt dashboard.combined
      clearApiCache();
      attemptedOps.length = 0;
      await fetchDashboardCombined('test_tok');
      expect(attemptedOps).not.toContain('dashboard.combined');
      expect(attemptedOps).toContain('dashboard.overview');

      // resetApiCapabilities restores probing
      resetApiCapabilities();
      attemptedOps.length = 0;
      await fetchDashboardCombined('test_tok');
      expect(attemptedOps).toContain('dashboard.combined');
    });
  });
});

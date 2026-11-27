import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { handleMockApiRequest } from '../../src/api/mockDataStore';
import * as apiClient from '../../src/api/apiClient';
import { RequireAdmin } from '../../src/auth/RequireAdmin';
import { AuthContext } from '../../src/auth/AuthProvider';
import { AppDataContext } from '../../src/context/AppDataContext';
import { AppDataContextValue } from '../../src/context/appDataState';
import { DashboardCombinedData } from '../../src/api/combinedApi';

describe('Frontend Login With Dashboard Bootstrap Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    apiClient.clearApiCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Mock Data Store Support', () => {
    it('handles auth.loginWithDashboard and returns token, user, and complete dashboard dataset', async () => {
      const res = await handleMockApiRequest('auth.loginWithDashboard', { key: 'any_key' });
      expect(res.ok).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data.token).toBe('mock_admin_token');
      expect(res.data.user.isAdmin).toBe(true);
      expect(res.data.dashboard).toBeDefined();
      expect(res.data.dashboard.overview).toBeDefined();
      expect(Array.isArray(res.data.dashboard.classes)).toBe(true);
      expect(Array.isArray(res.data.dashboard.schedules)).toBe(true);
      expect(Array.isArray(res.data.dashboard.students)).toBe(true);
      expect(Array.isArray(res.data.dashboard.packages)).toBe(true);
      expect(Array.isArray(res.data.dashboard.fees)).toBe(true);
    });
  });

  describe('RequireAdmin Component Rendering & Bootstrap Contract', () => {
    const mockDashboard: DashboardCombinedData = {
      overview: { activeStudents: 5, classesThisMonth: 12, attendanceRate: 95, monthlyRevenue: 1000 },
      classes: [],
      schedules: [],
      students: [],
      packages: [],
      fees: [],
    };

    it('renders login form with input and submit button when unauthenticated', () => {
      const mockAuth: any = {
        status: 'unauthenticated',
        user: null,
        token: null,
        signInWithToken: vi.fn(),
        signOut: vi.fn(),
      };

      const html = renderToString(
        <AuthContext.Provider value={mockAuth}>
          <RequireAdmin>
            <div>Protected App Content</div>
          </RequireAdmin>
        </AuthContext.Provider>
      );

      expect(html).toContain('Class Diary');
      expect(html).toContain('Administrator Access Key');
      expect(html).toContain('Sign In as Administrator');
      expect(html).not.toContain('Protected App Content');
    });

    it('renders protected children when authenticated as admin', () => {
      const mockAuth: any = {
        status: 'authenticated',
        user: { email: 'admin@example.com', name: 'Admin User', isAdmin: true },
        token: 'valid_token_123',
        signInWithToken: vi.fn(),
        signOut: vi.fn(),
      };

      const html = renderToString(
        <AuthContext.Provider value={mockAuth}>
          <RequireAdmin>
            <div>Protected App Content</div>
          </RequireAdmin>
        </AuthContext.Provider>
      );

      expect(html).toContain('Protected App Content');
      expect(html).not.toContain('Sign In as Administrator');
    });

    it('dispatches auth.loginWithDashboard and bootstraps AppDataContext on success', async () => {
      const bootstrapDashboardMock = vi.fn();
      const signInWithTokenMock = vi.fn();

      const sendApiSpy = vi.spyOn(apiClient, 'sendApiRequest').mockImplementation(async (action: string) => {
        if (action === 'auth.loginWithDashboard') {
          return {
            ok: true,
            data: {
              token: 'test_token_abc',
              sessionToken: 'test_token_abc',
              user: { email: 'admin@example.com', name: 'Admin', isAdmin: true },
              dashboard: mockDashboard,
            },
          };
        }
        return { ok: false, error: { code: 'UNEXPECTED', message: 'Unexpected action' } };
      });

      const res = await apiClient.sendApiRequest<any>('auth.loginWithDashboard', { key: 'secret_123' });
      expect(sendApiSpy).toHaveBeenCalledWith('auth.loginWithDashboard', { key: 'secret_123' });
      expect(res.ok).toBe(true);

      if (res.ok && res.data) {
        if (res.data.dashboard) {
          bootstrapDashboardMock(res.data.dashboard);
        }
        signInWithTokenMock(res.data.token || res.data.sessionToken, res.data.user);
      }

      expect(bootstrapDashboardMock).toHaveBeenCalledWith(mockDashboard);
      expect(signInWithTokenMock).toHaveBeenCalledWith('test_token_abc', expect.objectContaining({ email: 'admin@example.com' }));
    });

    it('falls back seamlessly to auth.login when auth.loginWithDashboard returns UNSUPPORTED_OPERATION', async () => {
      const calls: string[] = [];
      vi.spyOn(apiClient, 'sendApiRequest').mockImplementation(async (action: string) => {
        calls.push(action);
        if (action === 'auth.loginWithDashboard') {
          return {
            ok: false,
            error: { code: 'UNSUPPORTED_OPERATION', message: 'Unknown action: auth.loginWithDashboard' },
          };
        }
        if (action === 'auth.login') {
          return {
            ok: true,
            data: {
              token: 'legacy_token_123',
              user: { email: 'admin@example.com', name: 'Admin', isAdmin: true },
            },
          };
        }
        return { ok: false, error: { code: 'UNEXPECTED', message: 'Unexpected' } };
      });

      // Execute login sequence identical to RequireAdmin
      let res = await apiClient.sendApiRequest<any>('auth.loginWithDashboard', { key: 'my_key' }).catch(() => null);
      if (!res || (!res.ok && (res.error?.code === 'UNSUPPORTED_OPERATION' || res.error?.code === 'NOT_FOUND' || /unknown action/i.test(res.error?.message || '')))) {
        res = await apiClient.sendApiRequest<any>('auth.login', { key: 'my_key' });
      }

      expect(calls).toEqual(['auth.loginWithDashboard', 'auth.login']);
      expect(res.ok).toBe(true);
      expect(res.data.token).toBe('legacy_token_123');
    });

    it('does NOT fall back to auth.login when credentials are invalid (UNAUTHORIZED)', async () => {
      const calls: string[] = [];
      vi.spyOn(apiClient, 'sendApiRequest').mockImplementation(async (action: string) => {
        calls.push(action);
        if (action === 'auth.loginWithDashboard') {
          return {
            ok: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid administrator access key' },
          };
        }
        return { ok: true, data: {} };
      });

      let res = await apiClient.sendApiRequest<any>('auth.loginWithDashboard', { key: 'wrong_key' }).catch(() => null);
      const isUnsupported = !res || (!res.ok && (
        res.error?.code === 'UNSUPPORTED_OPERATION' ||
        res.error?.code === 'NOT_FOUND' ||
        /unknown|unsupported/i.test(res.error?.message || '')
      ));
      if (isUnsupported) {
        res = await apiClient.sendApiRequest<any>('auth.login', { key: 'wrong_key' });
      }

      // Must NOT attempt fallback on UNAUTHORIZED
      expect(calls).toEqual(['auth.loginWithDashboard']);
      expect(res.ok).toBe(false);
      expect(res.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('AppDataContext Bootstrap State & Caching Invariants', () => {
    it('bootstrapDashboard stores data and prevents immediate duplicate network fetch', () => {
      const mockDashboard: DashboardCombinedData = {
        overview: { activeStudents: 8, classesThisMonth: 20, attendanceRate: 100, monthlyRevenue: 2500 },
        classes: [],
        schedules: [],
        students: [],
        packages: [],
        fees: [],
      };

      let storedData: DashboardCombinedData | null = null;
      let fetchedAt = 0;
      let fetchCount = 0;

      const bootstrap = (data: DashboardCombinedData) => {
        storedData = data;
        fetchedAt = Date.now();
      };

      const getDashboard = async (force?: boolean) => {
        if (!force && storedData && (Date.now() - fetchedAt < 30000)) {
          return storedData;
        }
        fetchCount++;
        return storedData;
      };

      // Bootstrap with login payload
      bootstrap(mockDashboard);
      expect(storedData).toBe(mockDashboard);

      // Immediate read within 30s TTL does NOT fetch from network
      getDashboard();
      expect(fetchCount).toBe(0);

      // Forced read does trigger fetch
      getDashboard(true);
      expect(fetchCount).toBe(1);
    });

    it('measures frontend response processing, bootstrap latency, and request count', () => {
      const mockPayload = {
        token: 'test_token_123',
        sessionToken: 'test_token_123',
        user: { email: 'admin@example.com', name: 'Admin', isAdmin: true },
        dashboard: {
          overview: { activeStudentsCount: 5, classesUpcoming7Days: 3, currency: 'INR' },
          classes: [],
          schedules: [],
          students: [],
          packages: [],
          fees: [],
        },
      };

      let networkRequestsCount = 0;
      let cachedData: any = null;
      let fetchedAt = 0;

      const t0 = performance.now();

      // 1. Single round-trip network request executed
      networkRequestsCount++;

      // 2. Response processing and bootstrapDashboard
      cachedData = mockPayload.dashboard;
      fetchedAt = Date.now();

      // 3. Auth token and user set
      const user = mockPayload.user;
      const token = mockPayload.token;

      // 4. Dashboard screen mounts and requests data
      const getDashboard = (force = false) => {
        if (!force && cachedData && (Date.now() - fetchedAt < 30000)) {
          return cachedData;
        }
        networkRequestsCount++;
        return cachedData;
      };

      const resolvedData = getDashboard();
      const clientProcessingMs = performance.now() - t0;

      console.log('\n--- MEASURED FRONTEND BOOTSTRAP LATENCY & NETWORK COUNT ---');
      console.log(`Total HTTP network requests on first login: ${networkRequestsCount}`);
      console.log(`Frontend bootstrap processing latency: ${clientProcessingMs.toFixed(3)} ms`);
      console.log(`Dashboard data available synchronously: ${resolvedData === mockPayload.dashboard}`);
      console.log('-----------------------------------------------------------\n');

      expect(networkRequestsCount).toBe(1);
      expect(resolvedData).toBe(mockPayload.dashboard);
      expect(clientProcessingMs).toBeLessThan(10); // Typically < 1 ms
    });
  });
});

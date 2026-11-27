import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchDashboardCombined,
  fetchFinancesCombined,
  isOperationSupported,
  resetApiCapabilities,
  setBackendCapabilityVersion,
  getBackendCapabilityVersion,
  loadCapabilities,
  getCapabilityStorageKey,
  DEFAULT_CAPABILITY_VERSION,
} from '../../src/api/combinedApi';
import * as apiClient from '../../src/api/apiClient';
import { ApiClientError, ApiNetworkError } from '../../src/api/apiErrors';

describe('Frontend/Backend Capability Cache Invalidation & Versioning', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    (globalThis as any).sessionStorage = {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        mockStorage = {};
      },
    };
    resetApiCapabilities();
    setBackendCapabilityVersion(DEFAULT_CAPABILITY_VERSION);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetApiCapabilities();
    setBackendCapabilityVersion(DEFAULT_CAPABILITY_VERSION);
    vi.restoreAllMocks();
    delete (globalThis as any).sessionStorage;
    delete (globalThis as any).fetch;
  });

  it('1. Old deployment version marks combined endpoints unsupported when receiving UNKNOWN_OPERATION', async () => {
    setBackendCapabilityVersion('v1.0');
    expect(getBackendCapabilityVersion()).toBe('v1.0');

    vi.spyOn(apiClient, 'sendApiRequest').mockImplementation(async (op: string) => {
      if (op === 'dashboard.combined' || op === 'finances.combined') {
        throw new ApiClientError({ code: 'UNKNOWN_OPERATION', message: `Unknown operation: ${op}` }, 'req_test');
      }
      return { ok: true, data: {}, meta: { requestId: 'req_1', timestamp: '' } };
    });

    expect(isOperationSupported('dashboard.combined')).toBe(true);
    expect(isOperationSupported('finances.combined')).toBe(true);

    await fetchDashboardCombined('test_token');
    expect(isOperationSupported('dashboard.combined')).toBe(false);

    await fetchFinancesCombined('test_token');
    expect(isOperationSupported('finances.combined')).toBe(false);
  });

  it('2. New deployment version at the same URL invalidates unsupported flags', async () => {
    setBackendCapabilityVersion('v1.0');
    vi.spyOn(apiClient, 'sendApiRequest').mockImplementation(async (op: string) => {
      if (op === 'dashboard.combined' || op === 'finances.combined') {
        throw new ApiClientError({ code: 'UNKNOWN_OPERATION', message: `Unknown operation: ${op}` }, 'req_test');
      }
      return { ok: true, data: {}, meta: { requestId: 'req_1', timestamp: '' } };
    });

    await fetchDashboardCombined('test_token');
    await fetchFinancesCombined('test_token');
    expect(isOperationSupported('dashboard.combined')).toBe(false);
    expect(isOperationSupported('finances.combined')).toBe(false);

    setBackendCapabilityVersion('v2.1');
    expect(getBackendCapabilityVersion()).toBe('v2.1');

    expect(isOperationSupported('dashboard.combined')).toBe(true);
    expect(isOperationSupported('finances.combined')).toBe(true);
  });

  it('3. The next request calls dashboard.combined successfully after version upgrade', async () => {
    setBackendCapabilityVersion('v1.0');
    const attemptedOps: string[] = [];

    vi.spyOn(apiClient, 'sendApiRequest').mockImplementation(async (op: string) => {
      attemptedOps.push(op);
      if (op === 'dashboard.combined') {
        throw new ApiClientError({ code: 'UNKNOWN_OPERATION', message: 'Unknown operation' }, 'req_test');
      }
      return { ok: true, data: {}, meta: { requestId: 'req_1', timestamp: '' } };
    });

    await fetchDashboardCombined('test_token');
    expect(attemptedOps).toContain('dashboard.combined');
    expect(isOperationSupported('dashboard.combined')).toBe(false);

    setBackendCapabilityVersion('v2.1');
    attemptedOps.length = 0;

    const mockDashboardData = {
      overview: { activeStudentsCount: 15, upcomingClassesCount: 4 } as any,
      classes: [],
      schedules: [],
      students: [],
      packages: [],
      fees: [],
    };

    vi.spyOn(apiClient, 'sendApiRequest').mockImplementation(async (op: string) => {
      attemptedOps.push(op);
      if (op === 'dashboard.combined') {
        return { ok: true, data: mockDashboardData, meta: { capabilitiesVersion: 'v2.1', requestId: 'req_ok', timestamp: '' } };
      }
      return { ok: true, data: {}, meta: { requestId: 'req_1', timestamp: '' } };
    });

    const result = await fetchDashboardCombined('test_token');
    expect(attemptedOps).toEqual(['dashboard.combined']);
    expect(result.overview.activeStudentsCount).toBe(15);
    expect(isOperationSupported('dashboard.combined')).toBe(true);
  });

  it('4. The next request calls finances.combined successfully after version upgrade', async () => {
    setBackendCapabilityVersion('v1.0');
    const attemptedOps: string[] = [];

    vi.spyOn(apiClient, 'sendApiRequest').mockImplementation(async (op: string) => {
      attemptedOps.push(op);
      if (op === 'finances.combined') {
        throw new ApiClientError({ code: 'UNKNOWN_OPERATION', message: 'Unknown operation' }, 'req_test');
      }
      return { ok: true, data: {}, meta: { requestId: 'req_1', timestamp: '' } };
    });

    await fetchFinancesCombined('test_token');
    expect(isOperationSupported('finances.combined')).toBe(false);

    setBackendCapabilityVersion('v2.1');
    attemptedOps.length = 0;

    const mockFinancesData = {
      summary: { totalBilled: 50000, totalReceived: 35000, totalOutstanding: 15000 } as any,
      payments: [],
      packages: [],
    };

    vi.spyOn(apiClient, 'sendApiRequest').mockImplementation(async (op: string) => {
      attemptedOps.push(op);
      if (op === 'finances.combined') {
        return { ok: true, data: mockFinancesData, meta: { capabilitiesVersion: 'v2.1', requestId: 'req_ok', timestamp: '' } };
      }
      return { ok: true, data: {}, meta: { requestId: 'req_1', timestamp: '' } };
    });

    const result = await fetchFinancesCombined('test_token');
    expect(attemptedOps).toEqual(['finances.combined']);
    expect(result.summary.totalBilled).toBe(50000);
    expect(isOperationSupported('finances.combined')).toBe(true);
  });

  it('5. Subsequent requests reuse the supported capability without fallback', async () => {
    setBackendCapabilityVersion('v2.1');
    const callCount: Record<string, number> = {};

    vi.spyOn(apiClient, 'sendApiRequest').mockImplementation(async (op: string) => {
      callCount[op] = (callCount[op] || 0) + 1;
      return {
        ok: true,
        data: {
          overview: { activeStudentsCount: 10 } as any,
          classes: [],
          schedules: [],
          students: [],
          packages: [],
          fees: [],
        },
        meta: { requestId: 'req_1', timestamp: '' },
      };
    });

    await fetchDashboardCombined('test_token');
    await fetchDashboardCombined('test_token');
    await fetchDashboardCombined('test_token');

    expect(callCount['dashboard.combined']).toBe(3);
    expect(callCount['dashboard.overview']).toBeUndefined();
    expect(isOperationSupported('dashboard.combined')).toBe(true);
  });

  it('6. Normal page navigation does not invalidate capability state', async () => {
    setBackendCapabilityVersion('v2.1');

    vi.spyOn(apiClient, 'sendApiRequest').mockImplementation(async (op: string) => {
      if (op === 'dashboard.combined') {
        throw new ApiClientError({ code: 'UNKNOWN_OPERATION', message: 'Unknown operation' }, 'req_test');
      }
      return { ok: true, data: {}, meta: { requestId: 'req_1', timestamp: '' } };
    });

    await fetchDashboardCombined('test_token');
    expect(isOperationSupported('dashboard.combined')).toBe(false);

    expect(isOperationSupported('dashboard.combined')).toBe(false);

    let probedAgain = false;
    vi.spyOn(apiClient, 'sendApiRequest').mockImplementation(async (op: string) => {
      if (op === 'dashboard.combined') probedAgain = true;
      return { ok: true, data: {}, meta: { requestId: 'req_1', timestamp: '' } };
    });

    await fetchDashboardCombined('test_token');
    expect(probedAgain).toBe(false);
  });

  it('7. Network and authorization errors do not mark endpoints unsupported', async () => {
    setBackendCapabilityVersion('v2.1');
    expect(isOperationSupported('dashboard.combined')).toBe(true);

    vi.spyOn(apiClient, 'sendApiRequest').mockRejectedValueOnce(
      new ApiNetworkError('Failed to fetch: Connection timeout')
    );
    await expect(fetchDashboardCombined('test_token')).rejects.toThrow(ApiNetworkError);
    expect(isOperationSupported('dashboard.combined')).toBe(true);

    vi.spyOn(apiClient, 'sendApiRequest').mockRejectedValueOnce(
      new ApiClientError({ code: 'UNAUTHORIZED', message: 'Invalid session token' }, 'req_unauth')
    );
    await expect(fetchDashboardCombined('test_token')).rejects.toThrow(ApiClientError);
    expect(isOperationSupported('dashboard.combined')).toBe(true);

    vi.spyOn(apiClient, 'sendApiRequest').mockRejectedValueOnce(
      new ApiClientError({ code: 'FORBIDDEN', message: 'Forbidden' }, 'req_forbid')
    );
    await expect(fetchDashboardCombined('test_token')).rejects.toThrow(ApiClientError);
    expect(isOperationSupported('dashboard.combined')).toBe(true);

    vi.spyOn(apiClient, 'sendApiRequest').mockRejectedValueOnce(
      new ApiClientError({ code: 'INTERNAL_ERROR', message: 'Internal Server Error' }, 'req_err')
    );
    await expect(fetchDashboardCombined('test_token')).rejects.toThrow(ApiClientError);
    expect(isOperationSupported('dashboard.combined')).toBe(true);
  });

  it('8. End-to-End Automatic Response-to-Capability Synchronization via Legacy Response', async () => {
    setBackendCapabilityVersion('v1.0');
    expect(getBackendCapabilityVersion()).toBe('v1.0');

    const storageKey = getCapabilityStorageKey();
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ version: 'v1.0', unsupported: ['dashboard.combined', 'finances.combined'] })
    );
    loadCapabilities();
    expect(isOperationSupported('dashboard.combined')).toBe(false);
    expect(isOperationSupported('finances.combined')).toBe(false);

    const requestedOperations: string[] = [];

    (globalThis as any).fetch = vi.fn().mockImplementation(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      requestedOperations.push(body.operation);

      if (body.operation === 'dashboard.combined') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: {
              overview: { activeStudentsCount: 42, upcomingClassesCount: 10 },
              classes: [],
              schedules: [],
              students: [],
              packages: [],
              fees: [],
            },
            meta: { capabilitiesVersion: 'v2.1', requestId: body.requestId },
          }),
        };
      }

      if (body.operation === 'finances.combined') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: {
              summary: { totalBilled: 100000, totalReceived: 75000, totalOutstanding: 25000 },
              payments: [],
              packages: [],
            },
            meta: { capabilitiesVersion: 'v2.1', requestId: body.requestId },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: { activeStudentsCount: 42, upcomingClassesCount: 10, overdueFeesTotal: 0 },
          meta: { capabilitiesVersion: 'v2.1', requestId: body.requestId },
        }),
      };
    });

    const fallbackResult = await fetchDashboardCombined('test_token');
    expect(fallbackResult.overview.activeStudentsCount).toBe(42);
    expect(requestedOperations).toContain('dashboard.overview');

    expect(getBackendCapabilityVersion()).toBe('v2.1');
    expect(isOperationSupported('dashboard.combined')).toBe(true);
    expect(isOperationSupported('finances.combined')).toBe(true);

    const stored = sessionStorage.getItem(storageKey);
    expect(stored).toBeNull();

    requestedOperations.length = 0;
    const directDashResult = await fetchDashboardCombined('test_token');
    expect(requestedOperations).toEqual(['dashboard.combined']);
    expect(directDashResult.overview.activeStudentsCount).toBe(42);

    requestedOperations.length = 0;
    const directFinResult = await fetchFinancesCombined('test_token');
    expect(requestedOperations).toEqual(['finances.combined']);
    expect(directFinResult.summary.totalBilled).toBe(100000);

    requestedOperations.length = 0;
    await fetchDashboardCombined('test_token');
    await fetchFinancesCombined('test_token');
    expect(requestedOperations.length).toBe(0);
    expect(isOperationSupported('dashboard.combined')).toBe(true);
    expect(isOperationSupported('finances.combined')).toBe(true);
  });

  it('9. Successful response without capabilitiesVersion does NOT unexpectedly reset capability state', async () => {
    setBackendCapabilityVersion('v2.1');
    const storageKey = getCapabilityStorageKey();
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ version: 'v2.1', unsupported: ['some.other.op'] })
    );
    loadCapabilities();

    (globalThis as any).fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: { activeStudentsCount: 10 },
        meta: { requestId: 'req_no_caps' },
      }),
    }));

    await apiClient.sendApiRequest('dashboard.overview', {}, { skipCache: true });

    expect(getBackendCapabilityVersion()).toBe('v2.1');
    expect(isOperationSupported('some.other.op')).toBe(false);
  });

  it('10. Rollback to older backend version invalidates newer flags and synchronizes version', async () => {
    setBackendCapabilityVersion('v2.1');
    expect(getBackendCapabilityVersion()).toBe('v2.1');

    (globalThis as any).fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: { activeStudentsCount: 10 },
        meta: { capabilitiesVersion: 'v2.0', requestId: 'req_rollback' },
      }),
    }));

    await apiClient.sendApiRequest('dashboard.overview', {}, { skipCache: true });

    expect(getBackendCapabilityVersion()).toBe('v2.0');
  });

  it('11. Logout clears capability state in memory and sessionStorage', () => {
    setBackendCapabilityVersion('v2.1');
    const storageKey = getCapabilityStorageKey();
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ version: 'v2.1', unsupported: ['dashboard.combined'] })
    );
    loadCapabilities();
    expect(isOperationSupported('dashboard.combined')).toBe(false);

    resetApiCapabilities();
    expect(isOperationSupported('dashboard.combined')).toBe(true);
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockSpreadsheet } from '../mocks/MockSpreadsheet';

// @ts-ignore
import SheetRegistry from '../../02-backend/apps-script/sheets/SheetRegistry.gs';
// @ts-ignore
import SpreadsheetBootstrap from '../../02-backend/apps-script/sheets/SpreadsheetBootstrap.gs';
const SpreadsheetProvider = require('../../02-backend/apps-script/sheets/SpreadsheetProvider.gs');
// @ts-ignore
import ApiEntry from '../../02-backend/apps-script/api/ApiEntry.gs';

const { registerStudentOperations } = require('../../02-backend/apps-script/students/StudentHandlers.gs');
const { registerPackageOperations } = require('../../02-backend/apps-script/packages/PackageHandlers.gs');
const { registerPaymentOperations } = require('../../02-backend/apps-script/payments/PaymentHandlers.gs');
const { registerClassOperations } = require('../../02-backend/apps-script/classes/ClassHandlers.gs');
const { registerReportOperations } = require('../../02-backend/apps-script/reports/ReportHandlers.gs');
const { registerClassScheduleOperations } = require('../../02-backend/apps-script/classes/ClassScheduleHandlers.gs');

describe('Backend auth.loginWithDashboard — Secure Bootstrap & Parity', () => {
  let spreadsheet: any;
  let mockCacheStore: Record<string, string>;

  beforeEach(() => {
    mockCacheStore = {};
    (globalThis as any).CacheService = {
      getScriptCache: () => ({
        get: (key: string) => mockCacheStore[key] || null,
        put: (key: string, val: string, _ttl: number) => {
          mockCacheStore[key] = val;
        },
        remove: (key: string) => {
          delete mockCacheStore[key];
        },
      }),
    };

    spreadsheet = new MockSpreadsheet();
    SpreadsheetBootstrap.bootstrapSpreadsheet(spreadsheet, SheetRegistry, '1.0.0');
    SpreadsheetProvider.setMockSpreadsheet(spreadsheet);
    (globalThis as any).getSpreadsheet = () => spreadsheet;

    const mockRouter = {
      registerOperation: (name: string, fn: Function) => {
        // Registered for handlers
      },
    };
    registerStudentOperations(mockRouter);
    registerPackageOperations(mockRouter);
    registerPaymentOperations(mockRouter);
    registerClassOperations(mockRouter);
    registerReportOperations(mockRouter);
    registerClassScheduleOperations(mockRouter);
  });

  afterEach(() => {
    delete (globalThis as any).CacheService;
    delete (globalThis as any).getSpreadsheet;
  });

  it('authenticates valid credentials and returns session token + dashboard bootstrap payload', () => {
    const req = {
      postData: {
        contents: JSON.stringify({
          apiVersion: '1',
          operation: 'auth.loginWithDashboard',
          requestId: 'req_auth_dash_1',
          payload: { key: 'test_admin_secret_key_123' },
        }),
      },
    };

    const res = ApiEntry.doPost(req);
    expect(res.payload.success).toBe(true);
    expect(res.payload.error).toBeNull();
    expect(res.payload.data).toBeDefined();

    // Token & User
    expect(res.payload.data.token).toBeDefined();
    expect(typeof res.payload.data.token).toBe('string');
    expect(res.payload.data.sessionToken).toBe(res.payload.data.token);
    expect(res.payload.data.user).toBeDefined();
    expect(res.payload.data.user.isAdmin).toBe(true);
    expect(res.payload.data.user.email).toBe('ashreya0502@gmail.com');

    // Dashboard Payload Structure
    const dash = res.payload.data.dashboard;
    expect(dash).toBeDefined();
    expect(dash.overview).toBeDefined();
    expect(dash.overview.activeStudentsCount).toBeDefined();
    expect(dash.overview.classesUpcoming7Days).toBeDefined();
    expect(dash.overview.currency).toBeDefined();
    expect(Array.isArray(dash.classes)).toBe(true);
    expect(Array.isArray(dash.schedules)).toBe(true);
    expect(Array.isArray(dash.students)).toBe(true);
    expect(Array.isArray(dash.packages)).toBe(true);
    expect(Array.isArray(dash.fees)).toBe(true);

    // Capabilities Version
    expect(res.payload.meta?.capabilitiesVersion).toBe('v2.1');
  });

  it('rejects invalid access key with UNAUTHORIZED and leaks zero dashboard data', () => {
    const req = {
      postData: {
        contents: JSON.stringify({
          apiVersion: '1',
          operation: 'auth.loginWithDashboard',
          requestId: 'req_auth_dash_2',
          payload: { key: 'invalid_access_key_xyz' },
        }),
      },
    };

    const res = ApiEntry.doPost(req);
    expect(res.payload.success).toBe(false);
    expect(res.payload.error.code).toBe('UNAUTHORIZED');
    expect(res.payload.data).toBeNull();
  });

  it('rejects empty or missing access key with UNAUTHORIZED', () => {
    const req = {
      postData: {
        contents: JSON.stringify({
          apiVersion: '1',
          operation: 'auth.loginWithDashboard',
          requestId: 'req_auth_dash_3',
          payload: {},
        }),
      },
    };

    const res = ApiEntry.doPost(req);
    expect(res.payload.success).toBe(false);
    expect(res.payload.error.code).toBe('UNAUTHORIZED');
    expect(res.payload.data).toBeNull();
  });

  it('preserves existing auth.login endpoint without returning dashboard payload', () => {
    const req = {
      postData: {
        contents: JSON.stringify({
          apiVersion: '1',
          operation: 'auth.login',
          requestId: 'req_auth_legacy',
          payload: { key: 'test_admin_secret_key_123' },
        }),
      },
    };

    const res = ApiEntry.doPost(req);
    expect(res.payload.success).toBe(true);
    expect(res.payload.data.token).toBeDefined();
    expect(res.payload.data.user.isAdmin).toBe(true);
    expect(res.payload.data.dashboard).toBeUndefined();
  });

  it('exhibits payload parity between auth.loginWithDashboard and dashboard.combined', () => {
    // 1. Fetch via auth.loginWithDashboard
    const bootstrapReq = {
      postData: {
        contents: JSON.stringify({
          apiVersion: '1',
          operation: 'auth.loginWithDashboard',
          requestId: 'req_parity_boot',
          payload: { key: 'test_admin_secret_key_123' },
        }),
      },
    };
    const bootstrapRes = ApiEntry.doPost(bootstrapReq);
    expect(bootstrapRes.payload.success).toBe(true);
    const token = bootstrapRes.payload.data.token;
    const bootstrapDash = bootstrapRes.payload.data.dashboard;

    // 2. Fetch via dashboard.combined with authorized token
    const combinedReq = {
      postData: {
        contents: JSON.stringify({
          apiVersion: '1',
          operation: 'dashboard.combined',
          requestId: 'req_parity_comb',
          identityToken: token,
          payload: {},
        }),
      },
    };
    const combinedRes = ApiEntry.doPost(combinedReq);
    expect(combinedRes.payload.success).toBe(true);
    const combinedDash = combinedRes.payload.data;

    // 3. Verify exact parity of keys and structure
    expect(Object.keys(bootstrapDash).sort()).toEqual(Object.keys(combinedDash).sort());
    const { generatedAt: genA, ...overviewA } = bootstrapDash.overview;
    const { generatedAt: genB, ...overviewB } = combinedDash.overview;
    expect(overviewA).toEqual(overviewB);
    expect(typeof genA).toBe('string');
    expect(typeof genB).toBe('string');
    expect(bootstrapDash.classes).toEqual(combinedDash.classes);
    expect(bootstrapDash.schedules).toEqual(combinedDash.schedules);
    expect(bootstrapDash.students).toEqual(combinedDash.students);
    expect(bootstrapDash.packages).toEqual(combinedDash.packages);
    expect(bootstrapDash.fees).toEqual(combinedDash.fees);
  });

  it('respects rate limit lockout and never exposes dashboard data during lockout', () => {
    mockCacheStore['auth_lockout'] = '1';

    const req = {
      postData: {
        contents: JSON.stringify({
          apiVersion: '1',
          operation: 'auth.loginWithDashboard',
          requestId: 'req_auth_lockout',
          payload: { key: 'test_admin_secret_key_123' },
        }),
      },
    };

    const res = ApiEntry.doPost(req);
    expect(res.payload.success).toBe(false);
    expect(res.payload.error.code).toBe('RATE_LIMITED');
    expect(res.payload.data).toBeNull();
  });

  it('measures local simulation execution times: auth.loginWithDashboard vs sequential calls', () => {
    const authReq = {
      postData: {
        contents: JSON.stringify({
          apiVersion: '1',
          operation: 'auth.login',
          requestId: 'sim_auth',
          payload: { key: 'test_admin_secret_key_123' },
        }),
      },
    };
    const bootReq = {
      postData: {
        contents: JSON.stringify({
          apiVersion: '1',
          operation: 'auth.loginWithDashboard',
          requestId: 'sim_boot',
          payload: { key: 'test_admin_secret_key_123' },
        }),
      },
    };

    // Warm-up
    ApiEntry.doPost(authReq);
    ApiEntry.doPost(bootReq);

    const N = 50;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      ApiEntry.doPost(authReq);
    }
    const authMs = (performance.now() - t0) / N;

    const token = ApiEntry.doPost(authReq).payload.data.token;
    const dashReq = {
      postData: {
        contents: JSON.stringify({
          apiVersion: '1',
          operation: 'dashboard.combined',
          requestId: 'sim_dash',
          identityToken: token,
          payload: {},
        }),
      },
    };

    const t1 = performance.now();
    for (let i = 0; i < N; i++) {
      ApiEntry.doPost(dashReq);
    }
    const dashMs = (performance.now() - t1) / N;

    const t2 = performance.now();
    for (let i = 0; i < N; i++) {
      ApiEntry.doPost(bootReq);
    }
    const bootMs = (performance.now() - t2) / N;

    console.log('\n--- SIMULATED BACKEND EXECUTION TIMINGS (Node.js runtime) ---');
    console.log(`auth.login average: ${authMs.toFixed(3)} ms`);
    console.log(`dashboard.combined average: ${dashMs.toFixed(3)} ms`);
    console.log(`auth.loginWithDashboard average: ${bootMs.toFixed(3)} ms`);
    console.log(`Sum of separate calls: ${(authMs + dashMs).toFixed(3)} ms`);
    console.log(`Single-round-trip savings (local handler): ${((authMs + dashMs) - bootMs).toFixed(3)} ms`);
    console.log('-------------------------------------------------------------\n');

    expect(bootMs).toBeGreaterThan(0);
    expect(authMs).toBeGreaterThan(0);
    expect(dashMs).toBeGreaterThan(0);
  });
});

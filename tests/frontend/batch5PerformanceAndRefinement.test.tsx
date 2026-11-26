import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { clearApiCache, sendApiRequest } from '../../src/api/apiClient';
import { StudentFinancialCardView } from '../../src/domains/students/StudentFinancialCardView';
import { CurrencyFinancialBalance } from '../../src/domains/finances/studentFinancialAccounting';
import { StudentPerClassRateResult } from '../../src/domains/finances/packageRateCalculator';

describe('Batch 5 Performance and Student Financial Summary Refinements', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearApiCache();
  });

  describe('Change 1: Fast Loading & API Caching', () => {
    it('caches read-only operations across consecutive calls and eliminates redundant network calls', async () => {
      const mockResponse = {
        ok: true,
        data: [{ student_id: 'stu_1', full_name: 'Test Student' }],
        meta: { requestId: 'req_123', timestamp: '2026-03-15T10:00:00.000Z' },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const res1 = await sendApiRequest<any[]>('students.list', {}, { token: 'mock-valid-token' });
      expect(res1.ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Consecutive call hits memory cache
      const res2 = await sendApiRequest<any[]>('students.list', {}, { token: 'mock-valid-token' });
      expect(res2.ok).toBe(true);
      expect(res2.data).toEqual(res1.data);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1); // No second fetch
    });

    it('isolates cache by auth token', async () => {
      const mockResponse = {
        ok: true,
        data: [{ student_id: 'stu_1', full_name: 'Test Student' }],
        meta: { requestId: 'req_123', timestamp: '2026-03-15T10:00:00.000Z' },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await sendApiRequest<any[]>('students.list', {}, { token: 'token-A' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      await sendApiRequest<any[]>('students.list', {}, { token: 'token-B' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2); // Isolated by token
    });

    it('clears cache on mutation operations', async () => {
      const mockResponse = {
        ok: true,
        data: [{ student_id: 'stu_1', full_name: 'Test Student' }],
        meta: { requestId: 'req_123', timestamp: '2026-03-15T10:00:00.000Z' },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await sendApiRequest<any[]>('students.list', {}, { token: 'mock-valid-token' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Mutating operation clears read-only cache
      await sendApiRequest('students.create', { student_name: 'New Student' }, { token: 'mock-valid-token' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      // Next list will re-fetch
      await sendApiRequest<any[]>('students.list', {}, { token: 'mock-valid-token' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Change 2: Student Financial Summary 4 Metrics Only', () => {
    it('renders exactly 4 metrics and excludes Available Credit / Excess', () => {
      const balances: CurrencyFinancialBalance[] = [
        {
          currency: 'INR',
          totalPayable: 12500,
          totalPaid: 12500,
          outstanding: 0,
          availableCredit: 0,
          isReliable: true,
        },
      ];
      const rateResult: StudentPerClassRateResult = {
        hasRate: true,
        inrDisplay: '₹390.63 / class',
        localDisplay: null,
        inrRate: 390.63,
      };

      const html = renderToString(
        <StudentFinancialCardView balances={balances} rateResult={rateResult} loading={false} />
      );

      // Verify the 4 metrics are present:
      expect(html).toContain('Total Package Payable');
      expect(html).toContain('Total Payments Received');
      expect(html).toContain('Outstanding Amount');
      expect(html).toContain('Per-Class Rate');

      // Verify Available Credit / Excess is completely absent:
      expect(html).not.toContain('Available Credit');
      expect(html).not.toContain('Available Credit / Excess');
      expect(html).not.toContain('Excess');

      // Verify accurate formatted values:
      expect(html).toContain('₹12,500');
      expect(html).toContain('₹0.00 (Settled)');
      expect(html).toContain('₹390.63 / class');
    });

    it('handles multiple currency segregation with 4 metrics each', () => {
      const balances: CurrencyFinancialBalance[] = [
        {
          currency: 'USD',
          totalPayable: 300,
          totalPaid: 200,
          outstanding: 100,
          availableCredit: 0,
          isReliable: true,
        },
        {
          currency: 'AUD',
          totalPayable: 400,
          totalPaid: 500,
          outstanding: 0,
          availableCredit: 100,
          isReliable: true,
        },
      ];
      const rateResult: StudentPerClassRateResult = {
        hasRate: true,
        inrDisplay: '₹2,500.00 / class',
        localDisplay: '$30.00 / class',
        localCurrency: 'USD',
      };

      const html = renderToString(
        <StudentFinancialCardView balances={balances} rateResult={rateResult} loading={false} />
      );

      // USD check
      expect(html).toContain('Total Package Payable (<!-- -->USD<!-- -->)');
      expect(html).toContain('Total Payments Received (<!-- -->USD<!-- -->)');
      expect(html).toContain('Outstanding Amount (<!-- -->USD<!-- -->)');
      expect(html).toContain('Per-Class Rate (<!-- -->USD<!-- -->)');
      expect(html).toContain('$100 due');

      // AUD check
      expect(html).toContain('Total Package Payable (<!-- -->AUD<!-- -->)');
      expect(html).toContain('Total Payments Received (<!-- -->AUD<!-- -->)');
      expect(html).toContain('Outstanding Amount (<!-- -->AUD<!-- -->)');
      expect(html).toContain('Per-Class Rate (<!-- -->AUD<!-- -->)');

      // No Available Credit
      expect(html).not.toContain('Available Credit / Excess');
    });
  });
});

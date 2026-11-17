import { describe, it, expect, beforeEach } from 'vitest';
import {
  generatePaymentIdempotencyKey,
  getPendingPayment,
  setPendingPayment,
  clearPendingPayment,
  classifyPaymentError,
} from '../../src/domains/finances/paymentIdempotency';
import { sortPaymentsByDateDescending } from '../../src/domains/finances/financeSorting';
import { Payment } from '../../src/domains/finances/financeTypes';
import { ApiClientError, ApiNetworkError } from '../../src/api/apiErrors';

describe('Financial Stabilisation & Idempotency Safety', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    (globalThis as any).sessionStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
    };
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
    };
    clearPendingPayment();
  });

  describe('Idempotency Key & Error Classification', () => {
    it('generates unique UUID v4 idempotency keys', () => {
      const key1 = generatePaymentIdempotencyKey();
      const key2 = generatePaymentIdempotencyKey();
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key1).not.toBe(key2);
    });

    it('classifies DURABLE_PERSIST_FAILED as ALREADY_PERSISTED', () => {
      const err = new ApiClientError({ code: 'DURABLE_PERSIST_FAILED', message: 'Row written but intent failed' });
      expect(classifyPaymentError(err)).toBe('ALREADY_PERSISTED');
    });

    it('classifies VALIDATION_ERROR and IDEMPOTENCY_CONFLICT as DEFINITELY_NOT_PERSISTED', () => {
      const errVal = new ApiClientError({ code: 'VALIDATION_ERROR', message: 'Amount invalid' });
      expect(classifyPaymentError(errVal)).toBe('DEFINITELY_NOT_PERSISTED');

      const errConflict = new ApiClientError({ code: 'IDEMPOTENCY_CONFLICT', message: 'Payload changed' });
      expect(classifyPaymentError(errConflict)).toBe('DEFINITELY_NOT_PERSISTED');
    });

    it('classifies timeout and network drop as AMBIGUOUS_OUTCOME', () => {
      const timeoutErr = new ApiNetworkError('Request timed out after 60s');
      expect(classifyPaymentError(timeoutErr)).toBe('AMBIGUOUS_OUTCOME');

      const fetchErr = new ApiNetworkError('Failed to fetch');
      expect(classifyPaymentError(fetchErr)).toBe('AMBIGUOUS_OUTCOME');
    });

    it('saves, retrieves, and clears pending payment in dual storage', () => {
      expect(getPendingPayment()).toBeNull();
      const pending = {
        idempotency_key: 'idemp-123',
        student_id: 'STU_001',
        student_name: 'Ananya',
        amount: 500,
        currency: 'USD',
        in_inr: 41000,
        payment_date: '2026-11-15',
        dispatched_at: Date.now(),
        persistence_class: 'AMBIGUOUS_OUTCOME' as const,
      };
      setPendingPayment(pending);
      const retrieved = getPendingPayment();
      expect(retrieved).toEqual(pending);

      clearPendingPayment();
      expect(getPendingPayment()).toBeNull();
    });

    it('handles malformed stored payloads by clearing storage and returning null', () => {
      mockStorage['pd_pending_payments_v1'] = '{"corrupted": true}';
      expect(getPendingPayment()).toBeNull();
      expect(mockStorage['pd_pending_payments_v1']).toBeUndefined();

      mockStorage['pd_pending_payments_v1'] = 'not-even-json';
      expect(getPendingPayment()).toBeNull();
      expect(mockStorage['pd_pending_payments_v1']).toBeUndefined();
    });

    it('falls back to memory store if storage setItem throws', () => {
      const origSet = (globalThis as any).sessionStorage.setItem;
      const origLocalSet = (globalThis as any).localStorage.setItem;
      (globalThis as any).sessionStorage.setItem = () => { throw new Error('QuotaExceededError'); };
      (globalThis as any).localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
      try {
        const pending = {
          idempotency_key: 'idemp-mem-1',
          student_id: 'STU_MEM',
          student_name: 'Mem Student',
          amount: 1000,
          currency: 'INR',
          in_inr: 1000,
          payment_date: '2026-11-15',
          dispatched_at: Date.now(),
          persistence_class: 'AMBIGUOUS_OUTCOME' as const,
        };
        setPendingPayment(pending);
        expect(getPendingPayment()).toEqual(pending);
      } finally {
        (globalThis as any).sessionStorage.setItem = origSet;
        (globalThis as any).localStorage.setItem = origLocalSet;
      }
    });
  });

  describe('Ledger Sorting & Distinct Record Preservation', () => {
    it('sorts payments chronologically descending (newest first)', () => {
      const payments: Payment[] = [
        { payment_id: 'p1', student_id: 's1', amount: 1000, payment_date: '2025-01-10', payment_method: 'RECORDED' },
        { payment_id: 'p2', student_id: 's2', amount: 2000, payment_date: '2026-06-20', payment_method: 'RECORDED' },
        { payment_id: 'p3', student_id: 's3', amount: 1500, payment_date: '2025-11-05', payment_method: 'RECORDED' },
      ];
      const sorted = sortPaymentsByDateDescending(payments);
      expect(sorted.map((p) => p.payment_id)).toEqual(['p2', 'p3', 'p1']);
      expect(sorted.map((p) => p.payment_date)).toEqual(['2026-06-20', '2025-11-05', '2025-01-10']);
    });

    it('preserves distinct identical rows for same student, date, and amount without merging', () => {
      const identicalRows: Payment[] = [
        { payment_id: 'p1', student_id: 's1', amount: 5000, payment_date: '2026-03-01', payment_method: 'RECORDED' },
        { payment_id: 'p2', student_id: 's1', amount: 5000, payment_date: '2026-03-01', payment_method: 'RECORDED' },
      ];
      const sorted = sortPaymentsByDateDescending(identicalRows);
      expect(sorted.length).toBe(2);
      expect(sorted[0].amount).toBe(5000);
      expect(sorted[1].amount).toBe(5000);
    });
  });
});

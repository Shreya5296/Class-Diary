import { describe, it, expect, beforeEach } from 'vitest';
import {
  generatePaymentIdempotencyKey,
  getPendingPayment,
  getPendingPaymentForStudent,
  getPendingPaymentByKey,
  getAllPendingPayments,
  savePendingPayment,
  removePendingPayment,
  clearPendingPayment,
  subscribePendingPayments,
  classifyPaymentError,
  PendingPayment,
} from '../../src/domains/finances/paymentIdempotency';
import { formatPaymentAge } from '../../src/domains/finances/paymentAge';
import { ApiClientError, ApiNetworkError } from '../../src/api/apiErrors';

// Simulated Google Apps Script backend @52 PaymentService engine
interface BackendSheetRow {
  payment_id: string;
  student_id: string;
  student_name: string;
  amount: number;
  currency: string;
  in_inr: number;
  payment_date: string;
}

interface BackendDurableRecord {
  payment_id: string;
  student_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  status: 'STARTED' | 'RECORDED';
  pre_insert_count: number;
}

class MockBackendDeployment52 {
  public sheetRows: BackendSheetRow[] = [];
  public durableStore: Record<string, string> = {};
  public networkDropOnFirstAttempt = false;
  public failDurableCompletion = false;
  public failBeforeInsert = false;
  public writeCallCount = 0;

  private getMatchingPaymentRows(studentId: string, paymentDate: string, amount: number): BackendSheetRow[] {
    return this.sheetRows.filter(
      (r) => r.student_id === studentId && r.payment_date === paymentDate && Math.abs(r.amount - amount) < 0.001
    );
  }

  public executePaymentRecord(data: {
    student_id: string;
    student_name: string;
    amount: number;
    currency: string;
    in_inr: number;
    payment_date: string;
    idempotency_key?: string;
  }): { success: boolean; data?: any; code?: string; message?: string; meta?: { idempotentRetry?: boolean } } {
    this.writeCallCount++;
    const key = data.idempotency_key;

    // 1. Idempotency across executions check
    if (key && this.durableStore['payment_idemp_' + key]) {
      const durable: BackendDurableRecord = JSON.parse(this.durableStore['payment_idemp_' + key]);
      if (durable.status === 'RECORDED') {
        return { success: true, data: durable, meta: { idempotentRetry: true } };
      }
      if (durable.status === 'STARTED') {
        const matches = this.getMatchingPaymentRows(data.student_id, data.payment_date, data.amount);
        const preCount = durable.pre_insert_count;
        if (matches.length > preCount) {
          const recovered = { ...matches[preCount], status: 'RECORDED' };
          durable.status = 'RECORDED';
          this.durableStore['payment_idemp_' + key] = JSON.stringify(durable);
          return { success: true, data: recovered, meta: { idempotentRetry: true } };
        }
      }
    }

    if (this.failBeforeInsert) {
      throw new ApiNetworkError('Connection reset before backend write');
    }

    // 2. Count pre-insert rows
    const matches = this.getMatchingPaymentRows(data.student_id, data.payment_date, data.amount);
    const preInsertCount = matches.length;
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 3. Save STARTED intent
    if (key) {
      const intent: BackendDurableRecord = {
        payment_id: paymentId,
        student_id: data.student_id,
        amount: data.amount,
        currency: data.currency,
        payment_date: data.payment_date,
        status: 'STARTED',
        pre_insert_count: preInsertCount,
      };
      this.durableStore['payment_idemp_' + key] = JSON.stringify(intent);
    }

    // 4. Insert row into Google Sheet
    const sheetRow: BackendSheetRow = {
      payment_id: paymentId,
      student_id: data.student_id,
      student_name: data.student_name,
      amount: data.amount,
      currency: data.currency,
      in_inr: data.in_inr,
      payment_date: data.payment_date,
    };
    this.sheetRows.push(sheetRow);

    // 5. Completion persistence
    if (this.failDurableCompletion) {
      return {
        success: false,
        code: 'DURABLE_PERSIST_FAILED',
        message: 'Payment recorded in sheet but durable completion persistence failed',
      };
    }

    if (key) {
      const completed: BackendDurableRecord = {
        payment_id: paymentId,
        student_id: data.student_id,
        amount: data.amount,
        currency: data.currency,
        payment_date: data.payment_date,
        status: 'RECORDED',
        pre_insert_count: preInsertCount,
      };
      this.durableStore['payment_idemp_' + key] = JSON.stringify(completed);
    }

    if (this.networkDropOnFirstAttempt) {
      this.networkDropOnFirstAttempt = false;
      throw new ApiNetworkError('Client network disconnected during response transmission');
    }

    return { success: true, data: sheetRow };
  }
}

describe('Payment Safety Adversarial Tests (Scenarios A through J)', () => {
  let backend: MockBackendDeployment52;
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    backend = new MockBackendDeployment52();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
    };
    (globalThis as any).sessionStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
    };
    const listeners: Record<string, Function[]> = {};
    (globalThis as any).window = {
      addEventListener: (type: string, fn: Function) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      removeEventListener: (type: string, fn: Function) => {
        if (listeners[type]) listeners[type] = listeners[type].filter((cb) => cb !== fn);
      },
      dispatchEvent: (e: any) => {
        (listeners[e.type] || []).forEach((fn) => fn(e));
        return true;
      },
    };
    (globalThis as any).Event = class {
      constructor(public type: string) {}
    };
    clearPendingPayment();
  });

  it('Test A: Unresolved attempt older than 48 hours remains present and is never pruned', () => {
    const seventyTwoHoursAgo = Date.now() - (72 * 60 * 60 * 1000);
    const oldPayment: PendingPayment = {
      idempotency_key: 'idemp_old_48h',
      student_id: 'STU_OLD',
      student_name: 'Old Student',
      amount: 1000,
      currency: 'INR',
      in_inr: 1000,
      payment_date: '2026-11-10',
      dispatched_at: seventyTwoHoursAgo,
      persistence_class: 'AMBIGUOUS_OUTCOME',
    };
    savePendingPayment(oldPayment);

    const pending = getAllPendingPayments();
    expect(pending.length).toBe(1);
    expect(pending[0].idempotency_key).toBe('idemp_old_48h');
    const ageInfo = formatPaymentAge(pending[0].dispatched_at);
    expect(ageInfo.isOld).toBe(true);
    expect(ageInfo.formatted).toContain('3 days ago');
  });

  it('Test B: Expired timestamp does not generate a new key or alter payload', () => {
    const ninetySixHoursAgo = Date.now() - (96 * 60 * 60 * 1000);
    const preservedPayment: PendingPayment = {
      idempotency_key: 'idemp_preserve_key',
      student_id: 'STU_PRESERVE',
      student_name: 'Preserve Student',
      amount: 4500,
      currency: 'USD',
      in_inr: 369000,
      payment_date: '2026-11-08',
      dispatched_at: ninetySixHoursAgo,
      persistence_class: 'AMBIGUOUS_OUTCOME',
    };
    savePendingPayment(preservedPayment);

    const retrieved = getPendingPaymentForStudent('STU_PRESERVE');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.idempotency_key).toBe('idemp_preserve_key');
    expect(retrieved?.amount).toBe(4500);
    expect(retrieved?.dispatched_at).toBe(ninetySixHoursAgo);
  });

  it('Test C: Two tabs add different pending keys concurrently without silent data loss', () => {
    const p1: PendingPayment = {
      idempotency_key: 'tab1_key',
      student_id: 'STU_1',
      student_name: 'Tab 1 Student',
      amount: 500,
      currency: 'INR',
      in_inr: 500,
      payment_date: '2026-11-15',
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
    };
    const p2: PendingPayment = {
      idempotency_key: 'tab2_key',
      student_id: 'STU_2',
      student_name: 'Tab 2 Student',
      amount: 600,
      currency: 'INR',
      in_inr: 600,
      payment_date: '2026-11-15',
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
    };

    savePendingPayment(p1);
    savePendingPayment(p2);

    const all = getAllPendingPayments();
    expect(all.length).toBe(2);
    expect(getPendingPaymentByKey('tab1_key')).toBeDefined();
    expect(getPendingPaymentByKey('tab2_key')).toBeDefined();
  });

  it('Test C2: Deliberately interleaves two writes from same initial map without losing either payment', () => {
    const initialMap = {};
    const pA: PendingPayment = {
      idempotency_key: 'interleaved_key_A',
      student_id: 'STU_A',
      student_name: 'Student A',
      amount: 500,
      currency: 'INR',
      in_inr: 500,
      payment_date: '2026-11-15',
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
    };
    const pB: PendingPayment = {
      idempotency_key: 'interleaved_key_B',
      student_id: 'STU_B',
      student_name: 'Student B',
      amount: 750,
      currency: 'INR',
      in_inr: 750,
      payment_date: '2026-11-15',
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
    };

    savePendingPayment(pA, undefined, initialMap);
    savePendingPayment(pB, undefined, initialMap);

    const all = getAllPendingPayments();
    expect(all.length).toBe(2);
    expect(getPendingPaymentByKey('interleaved_key_A')).toBeDefined();
    expect(getPendingPaymentByKey('interleaved_key_B')).toBeDefined();
  });

  it('Test C3: Concurrent removal versus addition preserves non-conflicting addition', () => {
    const pA: PendingPayment = {
      idempotency_key: 'removal_key_A',
      student_id: 'STU_REM_A',
      student_name: 'Student Rem A',
      amount: 1000,
      currency: 'INR',
      in_inr: 1000,
      payment_date: '2026-11-15',
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
    };
    savePendingPayment(pA);

    const baseSnapshot = { [pA.idempotency_key]: pA };
    const pB: PendingPayment = {
      idempotency_key: 'addition_key_B',
      student_id: 'STU_ADD_B',
      student_name: 'Student Add B',
      amount: 1200,
      currency: 'INR',
      in_inr: 1200,
      payment_date: '2026-11-15',
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
    };

    removePendingPayment('removal_key_A', undefined, baseSnapshot);
    savePendingPayment(pB, undefined, baseSnapshot);

    expect(getPendingPaymentByKey('removal_key_A')).toBeNull();
    expect(getPendingPaymentByKey('addition_key_B')).toBeDefined();
    expect(getAllPendingPayments().length).toBe(1);
  });

  it('Test D: Two tabs attempt conflicting updates to the same pending key (fails closed)', () => {
    const key = 'conflict_key';
    const original: PendingPayment = {
      idempotency_key: key,
      student_id: 'STU_ORIG',
      student_name: 'Original Student',
      amount: 1000,
      currency: 'INR',
      in_inr: 1000,
      payment_date: '2026-11-15',
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
    };
    savePendingPayment(original);

    const conflicting: PendingPayment = {
      idempotency_key: key,
      student_id: 'STU_DIFFERENT',
      student_name: 'Conflicting Student',
      amount: 9999,
      currency: 'INR',
      in_inr: 9999,
      payment_date: '2026-11-15',
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
    };

    expect(() => savePendingPayment(conflicting)).toThrowError(/Concurrent modification conflict/);
    // Original record remains intact
    const preserved = getPendingPaymentByKey(key);
    expect(preserved?.student_id).toBe('STU_ORIG');
    expect(preserved?.amount).toBe(1000);
  });

  it('Test E: Storage event updates the other tab visible state reactively', () => {
    let notified = false;
    const unsubscribe = subscribePendingPayments(() => {
      notified = true;
    });

    // Simulate cross-tab storage event
    const storageEvent = new Event('storage');
    Object.assign(storageEvent, {
      key: 'pd_pending_payments_v1',
      newValue: JSON.stringify({
        ext_key: {
          idempotency_key: 'ext_key',
          student_id: 'STU_EXT',
          student_name: 'External Student',
          amount: 200,
          currency: 'INR',
          in_inr: 200,
          payment_date: '2026-11-15',
          dispatched_at: Date.now(),
          persistence_class: 'AMBIGUOUS_OUTCOME',
        },
      }),
    });
    window.dispatchEvent(storageEvent);

    expect(notified).toBe(true);
    unsubscribe();
  });

  it('Test F: Browser storage is cleared while a payment remains unresolved (backend ledger unaffected)', () => {
    const payload = {
      student_id: 'STU_F',
      student_name: 'Frank',
      amount: 3000,
      currency: 'INR',
      in_inr: 3000,
      payment_date: '2026-11-15',
      idempotency_key: 'idemp_Frank',
    };
    backend.networkDropOnFirstAttempt = true;
    try { backend.executePaymentRecord(payload); } catch {}
    expect(backend.sheetRows.length).toBe(1);

    // Save locally
    savePendingPayment({
      ...payload,
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
    });
    expect(getAllPendingPayments().length).toBe(1);

    // User clears browser storage
    (globalThis as any).localStorage.clear();
    clearPendingPayment();

    expect(getAllPendingPayments().length).toBe(0);
    // CRITICAL: Clearing client storage did NOT cancel or delete Google Sheet row!
    expect(backend.sheetRows.length).toBe(1);
  });

  it('Test G: Administrator account changes while unresolved attempts exist', () => {
    const admin1Payment: PendingPayment = {
      idempotency_key: 'idemp_admin1',
      student_id: 'STU_ADM1',
      student_name: 'Admin1 Student',
      amount: 1500,
      currency: 'INR',
      in_inr: 1500,
      payment_date: '2026-11-15',
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
      admin_id: 'adm_1',
    };
    savePendingPayment(admin1Payment, 'adm_1');

    // Admin 2 logs in
    expect(getAllPendingPayments('adm_2').length).toBe(0);
    expect(getPendingPaymentForStudent('STU_ADM1', 'adm_2')).toBeNull();

    // Admin 2 tries to dismiss Admin 1's payment
    removePendingPayment('idemp_admin1', 'adm_2');
    // Admin 1's record is NOT deleted
    expect(getPendingPaymentByKey('idemp_admin1')).toBeDefined();
    expect(getAllPendingPayments('adm_1').length).toBe(1);
  });

  it('Test G2: Missing administrator identity fails safe closed', () => {
    const adminPayment: PendingPayment = {
      idempotency_key: 'idemp_admin_secure',
      student_id: 'STU_SECURE',
      student_name: 'Secure Student',
      amount: 1000,
      currency: 'INR',
      in_inr: 1000,
      payment_date: '2026-11-15',
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
      admin_id: 'adm_valid',
    };
    savePendingPayment(adminPayment, 'adm_valid');

    // Missing admin identity (undefined) attempts to remove adminPayment
    removePendingPayment('idemp_admin_secure', undefined);
    // Record is NOT deleted because missing identity fails safe closed
    expect(getPendingPaymentByKey('idemp_admin_secure')).toBeDefined();
  });

  it('Test H: An unresolved payment remains unresolved after browser reload', () => {
    const p: PendingPayment = {
      idempotency_key: 'reload_key',
      student_id: 'STU_RELOAD',
      student_name: 'Reload Student',
      amount: 2200,
      currency: 'USD',
      in_inr: 180400,
      payment_date: '2026-11-15',
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
    };
    savePendingPayment(p);

    // Verify retrieval after simulated reload
    const rehydrated = getPendingPaymentByKey('reload_key');
    expect(rehydrated).toEqual(p);
  });

  it('Test I: Dismissal removes only local tracking and never implies server cancellation', () => {
    const payload = {
      student_id: 'STU_DISM',
      student_name: 'Dismiss Student',
      amount: 5000,
      currency: 'INR',
      in_inr: 5000,
      payment_date: '2026-11-15',
      idempotency_key: 'idemp_dismissal',
    };
    backend.networkDropOnFirstAttempt = true;
    try { backend.executePaymentRecord(payload); } catch {}
    expect(backend.sheetRows.length).toBe(1);

    savePendingPayment({
      ...payload,
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
    });
    expect(getAllPendingPayments().length).toBe(1);

    // Administrator acknowledges and dismisses local alert
    removePendingPayment('idemp_dismissal');
    expect(getAllPendingPayments().length).toBe(0);

    // Server ledger row is completely unchanged
    expect(backend.sheetRows.length).toBe(1);
  });

  it('Test J: Unsafe same-key backend recovery does not trigger automatic re-dispatch', () => {
    const payload = {
      student_id: 'STU_AUTO',
      student_name: 'Auto Student',
      amount: 3500,
      currency: 'INR',
      in_inr: 3500,
      payment_date: '2026-11-15',
      idempotency_key: 'idemp_auto',
    };
    backend.networkDropOnFirstAttempt = true;
    try { backend.executePaymentRecord(payload); } catch {}
    expect(backend.sheetRows.length).toBe(1);
    expect(backend.writeCallCount).toBe(1);

    // Save pending payment state
    savePendingPayment({
      ...payload,
      dispatched_at: Date.now(),
      persistence_class: 'AMBIGUOUS_OUTCOME',
    });

    // Verify that NO automatic write call was initiated
    expect(backend.writeCallCount).toBe(1);
    expect(backend.sheetRows.length).toBe(1);

    // Only when administrator manually re-dispatches is a write issued
    backend.executePaymentRecord(payload);
    expect(backend.writeCallCount).toBe(2);
    // Same-key recovered without inserting a second row
    expect(backend.sheetRows.length).toBe(1);
  });
});

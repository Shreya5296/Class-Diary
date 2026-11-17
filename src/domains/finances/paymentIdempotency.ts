import { isOwnedByAdmin } from './paymentAdminScope';
import { ErrorPersistenceClass, classifyPaymentError } from './paymentErrorClassifier';
import { safeMergePendingPayments, safeRemovePendingPayment } from './paymentStorageCoordinator';

export type { ErrorPersistenceClass };
export { classifyPaymentError };

export interface PendingPayment {
  idempotency_key: string;
  student_id: string;
  student_name: string;
  amount: number;
  currency: string;
  in_inr: number;
  payment_date: string;
  dispatched_at: number;
  persistence_class: ErrorPersistenceClass;
  last_error?: string;
  admin_id?: string;
}

const STORAGE_KEY = 'pd_pending_payments_v1';
const CHANGE_EVENT = 'pd_pending_payments_change';
let memoryStore: Record<string, PendingPayment> = {};

export function generatePaymentIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `pay_idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function isValidPendingPayment(obj: unknown): obj is PendingPayment {
  if (typeof obj !== 'object' || obj === null) return false;
  const p = obj as Record<string, unknown>;
  const pClass = p.persistence_class || 'AMBIGUOUS_OUTCOME';
  return (
    typeof p.idempotency_key === 'string' && p.idempotency_key.length > 0 &&
    typeof p.student_id === 'string' && p.student_id.length > 0 &&
    typeof p.amount === 'number' && !isNaN(p.amount) && p.amount > 0 &&
    typeof p.currency === 'string' && p.currency.length > 0 &&
    typeof p.payment_date === 'string' && p.payment_date.length >= 10 &&
    typeof p.dispatched_at === 'number' && (pClass === 'AMBIGUOUS_OUTCOME' || pClass === 'ALREADY_PERSISTED')
  );
}

function readStorageMap(): Record<string, PendingPayment> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch {}
  if (!raw) { try { raw = sessionStorage.getItem(STORAGE_KEY); } catch {} }
  if (!raw) return { ...memoryStore };

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) { clearAllClientStorage(); return {}; }
    const validMap: Record<string, PendingPayment> = {};
    let hasInvalid = false;
    for (const [key, val] of Object.entries(parsed)) {
      if (isValidPendingPayment(val)) {
        validMap[key] = { ...val, persistence_class: val.persistence_class || 'AMBIGUOUS_OUTCOME' };
      } else { hasInvalid = true; }
    }
    if (hasInvalid) writeStorageMap(validMap);
    return validMap;
  } catch {
    clearAllClientStorage();
    return {};
  }
}

function writeStorageMap(map: Record<string, PendingPayment>): void {
  memoryStore = { ...map };
  if (Object.keys(map).length === 0) { clearAllClientStorage(); notifyChange(); return; }
  const serialized = JSON.stringify(map);
  try { localStorage.setItem(STORAGE_KEY, serialized); } catch {}
  try { sessionStorage.setItem(STORAGE_KEY, serialized); } catch {}
  notifyChange();
}

function notifyChange(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch {}
  }
}

function clearAllClientStorage(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
}

export function subscribePendingPayments(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    if (e.type === CHANGE_EVENT || (e.type === 'storage' && (e as any).key === STORAGE_KEY)) callback();
  };
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function getAllPendingPayments(adminId?: string): PendingPayment[] {
  const all = Object.values(readStorageMap());
  return adminId ? all.filter((p) => isOwnedByAdmin(p.admin_id, adminId)) : all;
}

export function getOtherAdminPendingCount(currentAdminId?: string): number {
  if (!currentAdminId) return 0;
  return Object.values(readStorageMap()).filter((p) => p.admin_id && p.admin_id !== currentAdminId).length;
}

export function getPendingPaymentForStudent(studentId: string, adminId?: string): PendingPayment | null {
  return getAllPendingPayments(adminId).find((p) => p.student_id === studentId) || null;
}
export function getPendingPaymentByKey(key: string): PendingPayment | null { return readStorageMap()[key] || null; }

export function savePendingPayment(
  pending: PendingPayment, adminId?: string, baseSnapshot?: Record<string, PendingPayment>
): void {
  const normalized: PendingPayment = {
    ...pending, admin_id: pending.admin_id || adminId, persistence_class: pending.persistence_class || 'AMBIGUOUS_OUTCOME',
  };
  if (!isValidPendingPayment(normalized)) return;
  const current = readStorageMap();
  const merged = safeMergePendingPayments(current, normalized, baseSnapshot);
  writeStorageMap(merged);
}

export const setPendingPayment = savePendingPayment;

export function removePendingPayment(
  key: string, adminId?: string, baseSnapshot?: Record<string, PendingPayment>
): void {
  const current = readStorageMap();
  if (current[key] && !isOwnedByAdmin(current[key].admin_id, adminId)) return;
  const updated = safeRemovePendingPayment(current, key, baseSnapshot);
  writeStorageMap(updated);
}
export function getPendingPayment(adminId?: string): PendingPayment | null {
  return getAllPendingPayments(adminId)[0] || null;
}

export function clearPendingPayment(): void {
  memoryStore = {};
  clearAllClientStorage();
  notifyChange();
}

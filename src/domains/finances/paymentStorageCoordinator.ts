export interface PendingPaymentBase {
  idempotency_key: string;
  student_id: string;
  amount: number;
}

export function safeMergePendingPayments<T extends PendingPaymentBase>(
  current: Record<string, T>,
  incoming: T,
  baseSnapshot?: Record<string, T>
): Record<string, T> {
  const existing = current[incoming.idempotency_key];
  if (existing) {
    if (existing.student_id !== incoming.student_id || Math.abs(existing.amount - incoming.amount) > 0.001) {
      throw new Error(`Concurrent modification conflict on payment key ${incoming.idempotency_key}`);
    }
  } else if (baseSnapshot && baseSnapshot[incoming.idempotency_key]) {
    throw new Error(`Concurrent modification conflict: payment key ${incoming.idempotency_key} was removed by another session`);
  }

  const result: Record<string, T> = { ...current };
  result[incoming.idempotency_key] = incoming;
  return result;
}

export function safeRemovePendingPayment<T extends PendingPaymentBase>(
  current: Record<string, T>,
  keyToRemove: string,
  _baseSnapshot?: Record<string, T>
): Record<string, T> {
  const result: Record<string, T> = { ...current };
  delete result[keyToRemove];
  return result;
}

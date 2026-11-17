import { ApiClientError, ApiNetworkError } from '../../api/apiErrors';

export type ErrorPersistenceClass = 'DEFINITELY_NOT_PERSISTED' | 'AMBIGUOUS_OUTCOME' | 'ALREADY_PERSISTED';

export function classifyPaymentError(err: unknown): ErrorPersistenceClass {
  if (err instanceof ApiClientError) {
    if (err.code === 'DURABLE_PERSIST_FAILED') return 'ALREADY_PERSISTED';
    if (err.code === 'AMBIGUOUS_RECOVERY' || err.code === 'INTERNAL_ERROR') return 'AMBIGUOUS_OUTCOME';
    return 'DEFINITELY_NOT_PERSISTED';
  }
  if (err instanceof ApiNetworkError) return 'AMBIGUOUS_OUTCOME';
  return 'AMBIGUOUS_OUTCOME';
}

export interface PaymentAgeInfo {
  formatted: string;
  isOld: boolean;
  ageMs: number;
}

export function formatPaymentAge(dispatchedAt: number): PaymentAgeInfo {
  const ageMs = Math.max(0, Date.now() - dispatchedAt);
  const diffMins = Math.floor(ageMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let formatted = '';
  if (diffMins < 1) {
    formatted = 'just now';
  } else if (diffMins < 60) {
    formatted = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    formatted = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else {
    formatted = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  const isOld = diffHours >= 24;
  return { formatted, isOld, ageMs };
}

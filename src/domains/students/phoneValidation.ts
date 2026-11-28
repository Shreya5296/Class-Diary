/**
 * Validates student and parent phone numbers.
 * Rules:
 * - Allowed characters: digits, spaces, dashes (-), brackets (()), and a leading (+).
 * - If starts with '+', must contain 8 to 15 digits.
 * - Otherwise (national/India), must contain exactly 10 digits.
 * - Empty string allowed only when field is optional (!isRequired).
 */

export function isValidPhoneNumber(phone: string | undefined | null, isRequired = false): boolean {
  if (!phone || !phone.trim() || ((phone.trim() === '-' || phone.trim() === '—') && !isRequired)) {
    return !isRequired;
  }

  const trimmed = phone.trim();

  // Reject any character other than digits, spaces, dashes, brackets, and an optional single leading '+'
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) {
    return false;
  }

  const startsWithPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (startsWithPlus) {
    return digits.length >= 8 && digits.length <= 15;
  }

  return digits.length === 10;
}

export function validatePhoneField(
  phone: string | undefined | null,
  isRequired = false,
  emptyErrorMessage?: string
): string | undefined {
  if (!phone || !phone.trim() || ((phone.trim() === '-' || phone.trim() === '—') && !isRequired)) {
    if (isRequired) {
      return emptyErrorMessage || 'Enter a valid phone number';
    }
    return undefined;
  }

  if (!isValidPhoneNumber(phone, isRequired)) {
    return 'Enter a valid phone number';
  }

  return undefined;
}

import { describe, it, expect } from 'vitest';
import { isValidPhoneNumber, validatePhoneField } from '../../src/domains/students/phoneValidation';

describe('Fix L2: phoneValidation', () => {
  it('rejects plain text like "abc"', () => {
    expect(isValidPhoneNumber('abc')).toBe(false);
    expect(validatePhoneField('abc')).toBe('Enter a valid phone number');
  });

  it('rejects short numbers like "123"', () => {
    expect(isValidPhoneNumber('123')).toBe(false);
    expect(validatePhoneField('123')).toBe('Enter a valid phone number');
  });

  it('accepts 10-digit India numbers like "9000000000"', () => {
    expect(isValidPhoneNumber('9000000000')).toBe(true);
    expect(validatePhoneField('9000000000')).toBeUndefined();
  });

  it('accepts international numbers with leading + like "+91 90000 00000"', () => {
    expect(isValidPhoneNumber('+91 90000 00000')).toBe(true);
    expect(validatePhoneField('+91 90000 00000')).toBeUndefined();
  });

  it('accepts US international numbers with dashes like "+1-202-555-0123"', () => {
    expect(isValidPhoneNumber('+1-202-555-0123')).toBe(true);
    expect(validatePhoneField('+1-202-555-0123')).toBeUndefined();
  });

  it('allows empty phone when not required', () => {
    expect(isValidPhoneNumber('', false)).toBe(true);
    expect(isValidPhoneNumber('   ', false)).toBe(true);
    expect(validatePhoneField('', false)).toBeUndefined();
  });

  it('rejects empty phone when required', () => {
    expect(isValidPhoneNumber('', true)).toBe(false);
    expect(validatePhoneField('', true)).toBe('Enter a valid phone number');
    expect(validatePhoneField('', true, 'Parent phone is required.')).toBe('Parent phone is required.');
  });

  it('rejects special characters other than spaces, dashes, brackets, leading plus', () => {
    expect(isValidPhoneNumber('98765@43210')).toBe(false);
    expect(isValidPhoneNumber('9876543210+')).toBe(false);
    expect(isValidPhoneNumber('+91#9876543210')).toBe(false);
  });
});

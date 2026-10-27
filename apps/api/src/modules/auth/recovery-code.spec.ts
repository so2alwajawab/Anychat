import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { formatRecoveryCode, normalizeRecoveryCode } from './auth.service.js';

describe('recovery code formatting', () => {
  it('always emits codes accepted by the RecoveryDto regex', () => {
    for (let i = 0; i < 250; i++) {
      const code = formatRecoveryCode(randomBytes(16).toString('hex'));
      expect(code).toMatch(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/);
      expect(normalizeRecoveryCode(code)).toHaveLength(32);
      expect(normalizeRecoveryCode(code.toLowerCase())).toBe(normalizeRecoveryCode(code));
    }
  });

  it('normalizes separators and casing for lookup', () => {
    expect(normalizeRecoveryCode('0123-4567-89ab-cdef')).toBe('0123456789ABCDEF');
  });
});

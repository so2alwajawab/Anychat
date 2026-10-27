import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN_LENGTH, validatePassword } from '@anychat/shared';

describe('validatePassword', () => {
  it('rejects passwords shorter than the minimum length', () => {
    expect(validatePassword('short1')).toEqual({
      ok: false,
      reason: `PASSWORD_SHORTER_THAN_${PASSWORD_MIN_LENGTH}`,
    });
  });

  it('accepts a strong passphrase without a username', () => {
    expect(validatePassword('MetaDev-2026-Chat')).toEqual({ ok: true });
  });

  it('rejects common passwords even when long enough', () => {
    expect(validatePassword('password1234')).toEqual({ ok: false, reason: 'PASSWORD_COMMON' });
  });

  it('rejects single-character repeated passwords', () => {
    expect(validatePassword('aaaaaaaaaaaaaa')).toEqual({ ok: false, reason: 'PASSWORD_REPEATED' });
  });

  it('rejects passwords containing the username (case-insensitive)', () => {
    expect(validatePassword('myOwnerSecret2026', 'owner')).toEqual({
      ok: false,
      reason: 'PASSWORD_CONTAINS_USERNAME',
    });
  });

  it('rejects passwords above the maximum length', () => {
    expect(validatePassword('x'.repeat(257))).toEqual({ ok: false, reason: 'PASSWORD_TOO_LONG' });
  });
});

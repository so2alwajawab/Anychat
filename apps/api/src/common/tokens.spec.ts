import { describe, expect, it } from 'vitest';
import { CSRF_COOKIE, SESSION_COOKIE, randomToken, timingSafeEqualString, toBase64Url } from '@anychat/shared';

describe('tokens', () => {
  it('randomToken returns URL-safe tokens of the requested byte length', () => {
    const token = randomToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBe(43);
    expect(randomToken(32)).not.toBe(token);
  });

  it('toBase64Url produces no padding and URL-safe characters only', () => {
    const bytes = new Uint8Array([251, 255, 190, 0, 1]);
    const encoded = toBase64Url(bytes);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
    expect(encoded).not.toContain('=');
  });

  it('timingSafeEqualString compares without leaking length first', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true);
    expect(timingSafeEqualString('abc', 'abd')).toBe(false);
    expect(timingSafeEqualString('abc', 'abcd')).toBe(false);
    expect(timingSafeEqualString('', '')).toBe(true);
  });

  it('exposes stable cookie/header names', () => {
    expect(SESSION_COOKIE).toBe('anychat_sid');
    expect(CSRF_COOKIE).toBe('anychat_csrf');
  });
});

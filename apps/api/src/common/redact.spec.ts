import { describe, expect, it } from 'vitest';
import { isSensitiveKey, redactValue } from '@anychat/shared';

describe('redactValue', () => {
  it('redacts sensitive keys at any depth', () => {
    const input = {
      username: 'owner',
      password: 'hunter2',
      nested: { apiKey: 'sk-123', keep: 'value' },
      items: [{ csrfToken: 'abc', id: 1 }],
    };
    expect(redactValue(input)).toEqual({
      username: 'owner',
      password: '[REDACTED]',
      nested: { apiKey: '[REDACTED]', keep: 'value' },
      items: [{ csrfToken: '[REDACTED]', id: 1 }],
    });
  });

  it('redacts extra keys case-insensitively', () => {
    expect(redactValue({ CustomField: 'v' }, ['customfield'])).toEqual({
      CustomField: '[REDACTED]',
    });
  });

  it('returns primitives and null unchanged', () => {
    expect(redactValue('plain')).toBe('plain');
    expect(redactValue(null)).toBeNull();
    expect(redactValue(42)).toBe(42);
  });

  it('classifies sensitive and safe keys', () => {
    expect(isSensitiveKey('accessToken')).toBe(true);
    expect(isSensitiveKey('recoveryCode')).toBe(true);
    expect(isSensitiveKey('set-cookie')).toBe(true);
    expect(isSensitiveKey('username')).toBe(false);
    expect(isSensitiveKey('status')).toBe(false);
  });
});

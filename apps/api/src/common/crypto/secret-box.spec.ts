import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_KEY_VERSION,
  decodeBase64Key,
  openFromPartsWithKeys,
  openFromParts,
  openFromString,
  openFromStringWithKeys,
  sealToParts,
  sealToString,
} from './secret-box.js';

const key = randomBytes(32);

describe('secret-box (AES-256-GCM)', () => {
  it('round-trips through parts form', () => {
    const sealed = sealToParts('EAABsbCSkgi4B...', 'cred-1:asset-1', key);
    expect(sealed.keyVersion).toBe(CURRENT_KEY_VERSION);
    expect(openFromParts(sealed, 'cred-1:asset-1', key)).toBe('EAABsbCSkgi4B...');
  });

  it('round-trips through string form', () => {
    const sealed = sealToString('webhook-verify-token', 'cfg-1:verify', key);
    expect(sealed.split(':')).toHaveLength(3);
    expect(openFromString(sealed, 'cfg-1:verify', key)).toBe('webhook-verify-token');
  });

  it('rejects AAD mismatch (ciphertext swapping)', () => {
    const sealed = sealToParts('secret-value', 'cred-1:asset-1', key);
    expect(() => openFromParts(sealed, 'cred-2:asset-1', key)).toThrow();
  });

  it('rejects wrong key', () => {
    const sealed = sealToParts('secret-value', 'aad', key);
    expect(() => openFromParts(sealed, 'aad', randomBytes(32))).toThrow();
  });

  it('produces unique nonces per seal', () => {
    const a = sealToParts('same', 'aad', key);
    const b = sealToParts('same', 'aad', key);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('validates key length', () => {
    expect(() => decodeBase64Key(Buffer.alloc(16).toString('base64'))).toThrow();
    expect(decodeBase64Key(Buffer.alloc(32).toString('base64')).length).toBe(32);
  });

  it('supports key rotation: old-sealed data opens after rotation, reseal drops the old key', () => {
    const oldKey = randomBytes(32);
    const newKey = randomBytes(32);
    const sealed = sealToString('EAABsbCSkgi4B...', 'cred-1:asset-1', oldKey);

    // Rotation: new key becomes current, old key kept for decryption only.
    expect(openFromStringWithKeys(sealed, 'cred-1:asset-1', [newKey, oldKey])).toBe(
      'EAABsbCSkgi4B...',
    );

    // Re-encrypt with the current key, then the old key can be dropped entirely.
    const resealed = sealToString('EAABsbCSkgi4B...', 'cred-1:asset-1', newKey);
    expect(openFromStringWithKeys(resealed, 'cred-1:asset-1', [newKey])).toBe('EAABsbCSkgi4B...');
    expect(() => openFromStringWithKeys(sealed, 'cred-1:asset-1', [newKey])).toThrow();
    expect(openFromString(resealed, 'cred-1:asset-1', newKey)).toBe('EAABsbCSkgi4B...');
  });

  it('openFromPartsWithKeys tries keys in order and fails when none match', () => {
    const keyA = randomBytes(32);
    const keyB = randomBytes(32);
    const sealed = sealToParts('token', 'aad', keyB);
    expect(openFromPartsWithKeys(sealed, 'aad', [keyA, keyB])).toBe('token');
    expect(() => openFromPartsWithKeys(sealed, 'aad', [keyA, randomBytes(32)])).toThrow();
  });
});

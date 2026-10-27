import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
export const CURRENT_KEY_VERSION = 'v1';

export interface SealedParts {
  ciphertext: string;
  nonce: string;
  keyVersion: string;
}

export function decodeBase64Key(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error('encryption key must decode to exactly 32 bytes');
  }
  return key;
}

function sealBuffer(plaintext: string, aad: string, key: Buffer): { iv: Buffer; tag: Buffer; data: Buffer } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), data };
}

function openBuffer(iv: Buffer, tag: Buffer, data: Buffer, aad: string, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function sealToParts(
  plaintext: string,
  aad: string,
  key: Buffer,
  keyVersion: string = CURRENT_KEY_VERSION,
): SealedParts {
  const { iv, tag, data } = sealBuffer(plaintext, aad, key);
  return {
    ciphertext: Buffer.concat([tag, data]).toString('base64'),
    nonce: iv.toString('base64'),
    keyVersion,
  };
}

export function openFromParts(parts: SealedParts, aad: string, key: Buffer): string {
  const blob = Buffer.from(parts.ciphertext, 'base64');
  if (blob.length <= TAG_BYTES) throw new Error('ciphertext too short');
  const tag = blob.subarray(0, TAG_BYTES);
  const data = blob.subarray(TAG_BYTES);
  const iv = Buffer.from(parts.nonce, 'base64');
  if (iv.length !== IV_BYTES) throw new Error('invalid nonce length');
  return openBuffer(iv, tag, data, aad, key);
}

/** Single-string sealed form: `keyVersion:nonceB64:tag||dataB64`. */
export function sealToString(plaintext: string, aad: string, key: Buffer, keyVersion: string = CURRENT_KEY_VERSION): string {
  const parts = sealToParts(plaintext, aad, key, keyVersion);
  return `${parts.keyVersion}:${parts.nonce}:${parts.ciphertext}`;
}

export function openFromString(sealed: string, aad: string, key: Buffer): string {
  const first = sealed.indexOf(':');
  const second = sealed.indexOf(':', first + 1);
  if (first <= 0 || second <= first) throw new Error('invalid sealed string');
  return openFromParts(
    {
      keyVersion: sealed.slice(0, first),
      nonce: sealed.slice(first + 1, second),
      ciphertext: sealed.slice(second + 1),
    },
    aad,
    key,
  );
}

/**
 * Rotation-aware decrypt: tries each key until GCM authentication passes.
 * Order is the caller's responsibility (current key first).
 */
export function openFromPartsWithKeys(parts: SealedParts, aad: string, keys: Buffer[]): string {
  let lastError: unknown;
  for (const key of keys) {
    try {
      return openFromParts(parts, aad, key);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('no keys to try');
}

/** String-form variant of {@link openFromPartsWithKeys}. */
export function openFromStringWithKeys(sealed: string, aad: string, keys: Buffer[]): string {
  const first = sealed.indexOf(':');
  const second = sealed.indexOf(':', first + 1);
  if (first <= 0 || second <= first) throw new Error('invalid sealed string');
  return openFromPartsWithKeys(
    {
      keyVersion: sealed.slice(0, first),
      nonce: sealed.slice(first + 1, second),
      ciphertext: sealed.slice(second + 1),
    },
    aad,
    keys,
  );
}

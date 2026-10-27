import { Injectable } from '@nestjs/common';
import { serverEnv } from '../../common/config/env.js';
import {
  decodeBase64Key,
  openFromPartsWithKeys,
  openFromStringWithKeys,
  type SealedParts,
} from '../../common/crypto/secret-box.js';

@Injectable()
export class EncryptionKeyService {
  private cached: Buffer | null = null;
  private cachedOld: Buffer[] | null = null;

  get isConfigured(): boolean {
    return Boolean(serverEnv.APP_ENCRYPTION_KEY);
  }

  get key(): Buffer {
    if (!serverEnv.APP_ENCRYPTION_KEY) {
      throw new Error('APP_ENCRYPTION_KEY is not configured');
    }
    if (!this.cached) {
      this.cached = decodeBase64Key(serverEnv.APP_ENCRYPTION_KEY);
    }
    return this.cached;
  }

  /** Previous keys kept only for decryption during a rotation grace period. */
  private get oldKeys(): Buffer[] {
    const raw = serverEnv.APP_ENCRYPTION_KEY_OLD;
    if (!raw) return [];
    if (!this.cachedOld) {
      this.cachedOld = raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => decodeBase64Key(value));
    }
    return this.cachedOld;
  }

  /** Decrypt trying the current key first, then rotation-grace old keys. */
  openString(sealed: string, aad: string): string {
    return openFromStringWithKeys(sealed, aad, [this.key, ...this.oldKeys]);
  }

  openParts(parts: SealedParts, aad: string): string {
    return openFromPartsWithKeys(parts, aad, [this.key, ...this.oldKeys]);
  }
}

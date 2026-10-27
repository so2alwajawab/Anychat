import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../common/crypto/hash.js';
import { computeDeliveryHash, signatureValid } from './webhook.service.js';

describe('webhook delivery hash', () => {
  it('is stable for the same delivery unit', () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: '111',
          time: 1700000000,
          changes: [
            { field: 'feed', value: { comment_id: 'c_1', verb: 'add', message: 'مرحبا' } },
          ],
        },
      ],
    };
    const a = computeDeliveryHash(payload, payload.entry[0]!);
    const b = computeDeliveryHash(payload, payload.entry[0]!);
    expect(a).toBe(b);
    expect(a).toBe(
      sha256Hex(
        JSON.stringify({
          object: 'page',
          entryId: '111',
          time: 1700000000,
          field: 'feed',
          valueId: 'c_1',
          verb: 'add',
        }),
      ),
    );
  });

  it('differs across comments and objects', () => {
    const base = {
      object: 'page',
      entry: [
        { id: '111', time: 1, changes: [{ field: 'feed', value: { comment_id: 'c_1', verb: 'add' } }] },
      ],
    };
    const other = {
      object: 'page',
      entry: [
        { id: '111', time: 1, changes: [{ field: 'feed', value: { comment_id: 'c_2', verb: 'add' } }] },
      ],
    };
    expect(computeDeliveryHash(base, base.entry[0]!)).not.toBe(
      computeDeliveryHash(other, other.entry[0]!),
    );
  });
});

describe('webhook signature validation', () => {
  const raw = Buffer.from('{"object":"page","entry":[]}');
  const secret = 'test-app-secret-value';

  it('accepts a valid sha256 HMAC header', () => {
    const mac = createHmac('sha256', secret).update(raw).digest('hex');
    expect(signatureValid(raw, `sha256=${mac}`, secret)).toBe(true);
  });

  it('rejects wrong secret, wrong header, tampered body, missing header', () => {
    const mac = createHmac('sha256', secret).update(raw).digest('hex');
    expect(signatureValid(raw, `sha256=${mac}`, 'other-secret')).toBe(false);
    expect(signatureValid(raw, `sha1=${mac}`, secret)).toBe(false);
    expect(signatureValid(Buffer.from('tampered'), `sha256=${mac}`, secret)).toBe(false);
    expect(signatureValid(raw, undefined, secret)).toBe(false);
  });
});

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { CSRF_COOKIE, isSensitiveKey } from '@anychat/shared';
import { PrismaService } from '../src/common/prisma/prisma.module.js';
import { sha256Hex } from '../src/common/crypto/hash.js';
import { normalizeRecoveryCode } from '../src/modules/auth/auth.service.js';
import argon2 from 'argon2';
import {
  CookieJar,
  Http,
  TEST_PASSWORD,
  TEST_RECOVERY_CODE,
  TEST_USERNAME,
  createTestApp,
  getCsrf,
  login,
  postWithCsrf,
  seedOwner,
} from './helpers.js';

/**
 * Gate G1.7 — no secret fields in any API response.
 *
 * Walks real JSON responses and fails on any key classified as sensitive
 * (password, hash, token, secret, recovery, ...). Two documented exceptions:
 * - GET /api/v1/auth/csrf returns the caller's own CSRF token (double-submit
 *   pair with the cookie it just set).
 * - The recovery endpoint returns the freshly issued `recoveryCode` once, as
 *   the credential handover to the owner who redeemed the old code (analogous
 *   to showing a new password once) — only that top-level key is excluded.
 */
const RECOVERED_PASSWORD = 'Rotated-Password-2026';
function findSensitiveKeys(
  value: unknown,
  path: string,
  out: string[] = [],
  allowPaths: string[] = [],
): string[] {
  if (value === null || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((item, i) => findSensitiveKeys(item, `${path}[${i}]`, out, allowPaths));
    return out;
  }
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if (!allowPaths.includes(childPath) && isSensitiveKey(key)) out.push(childPath);
    findSensitiveKeys(val, childPath, out, allowPaths);
  }
  return out;
}

describe('response shape (e2e, Gate G1.7)', () => {
  let app: NestExpressApplication;
  let http: Http;
  let jar: CookieJar;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    jar = new CookieJar();

    const prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE audit_log, password_recovery, owner_session, owner_account, system_setting, membership, organization RESTART IDENTITY CASCADE',
    );
    const passwordHash = await argon2.hash(TEST_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    const { ownerId } = await seedOwner(prisma, { username: TEST_USERNAME, passwordHash });
    await prisma.passwordRecovery.create({
      data: {
        ownerId,
        codeHash: sha256Hex(normalizeRecoveryCode(TEST_RECOVERY_CODE)),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('login/session/audit responses contain no sensitive keys', async () => {
    const loginRes = await login(http, jar, TEST_USERNAME, TEST_PASSWORD);
    expect(loginRes.status).toBe(200);
    expect(findSensitiveKeys(loginRes.body, '$')).toEqual([]);
    expect(Object.keys(loginRes.body)).toEqual(['user']);
    expect(Object.keys(loginRes.body.user).sort()).toEqual(['id', 'username']);

    const sessionRes = await http
      .get('/api/v1/auth/session')
      .set('Cookie', jar.header())
      .expect(200);
    expect(findSensitiveKeys(sessionRes.body, '$')).toEqual([]);
    expect(Object.keys(sessionRes.body.user).sort()).toEqual([
      'id',
      'platformAdmin',
      'username',
    ]);

    const auditRes = await http
      .get('/api/v1/audit?limit=10')
      .set('Cookie', jar.header())
      .expect(200);
    expect(findSensitiveKeys(auditRes.body, '$')).toEqual([]);
    expect(auditRes.body.items.length).toBeGreaterThan(0);
  });

  it('recovery response leaks nothing besides the one-time code handover', async () => {
    const recoveryJar = new CookieJar();
    const res = await postWithCsrf(http, recoveryJar, '/api/v1/auth/recovery', {
      code: TEST_RECOVERY_CODE,
      newPassword: RECOVERED_PASSWORD,
    });
    expect(res.status).toBe(200);
    const { recoveryCode, ...rest } = res.body as Record<string, unknown>;
    expect(typeof recoveryCode).toBe('string');
    expect(findSensitiveKeys(rest, '$')).toEqual([]);
  });

  it('error and health responses contain no sensitive keys', async () => {
    const unauth = await http.get('/api/v1/auth/session').expect(401);
    expect(findSensitiveKeys(unauth.body, '$')).toEqual([]);

    const health = await http.get('/healthz').expect(200);
    expect(findSensitiveKeys(health.body, '$')).toEqual([]);

    const ready = await http.get('/readyz').expect(200);
    expect(findSensitiveKeys(ready.body, '$')).toEqual([]);
  });

  it('meta config/assets/diagnostics responses contain metadata only', async () => {
    // The recovery test above rotated the password and revoked all sessions.
    const relogin = await login(http, jar, TEST_USERNAME, RECOVERED_PASSWORD);
    expect(relogin.status).toBe(200);
    const csrf = jar.get(CSRF_COOKIE) ?? (await getCsrf(http, jar));
    // `hasAppSecret`/`hasVerifyToken` are boolean "configured" flags by design
    // (the actual values never leave the backend) — allowed at these paths only.
    const configAllow = ['$.hasAppSecret', '$.hasVerifyToken'];
    const put = await http
      .put('/api/v1/meta/config')
      .set('Cookie', jar.header())
      .set('x-csrf-token', csrf)
      .send({
        appId: '999999999',
        appSecret: 'response-shape-test-secret',
        webhookVerifyToken: 'response-shape-verify-token',
      })
      .expect(200);
    expect(findSensitiveKeys(put.body, '$', [], configAllow)).toEqual([]);

    const config = await http.get('/api/v1/meta/config').set('Cookie', jar.header()).expect(200);
    expect(findSensitiveKeys(config.body, '$', [], configAllow)).toEqual([]);
    expect(JSON.stringify(config.body)).not.toContain('response-shape-test-secret');

    const assets = await http.get('/api/v1/meta/assets').set('Cookie', jar.header()).expect(200);
    expect(findSensitiveKeys(assets.body, '$')).toEqual([]);

    const diagnostics = await http
      .get('/api/v1/meta/webhooks/diagnostics')
      .set('Cookie', jar.header())
      .expect(200);
    expect(findSensitiveKeys(diagnostics.body, '$')).toEqual([]);

    const missing = await http
      .get('/api/v1/meta/assets/00000000-0000-4000-8000-000000000000/health')
      .set('Cookie', jar.header())
      .expect(404);
    expect(findSensitiveKeys(missing.body, '$')).toEqual([]);
  });
});

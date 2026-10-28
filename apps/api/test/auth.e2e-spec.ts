import argon2 from 'argon2';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { CSRF_COOKIE, ERROR_CODES, SESSION_COOKIE, randomToken } from '@anychat/shared';
import { PrismaService } from '../src/common/prisma/prisma.module.js';
import { RedisService } from '../src/common/redis/redis.module.js';
import { sha256Hex } from '../src/common/crypto/hash.js';
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

describe('auth (e2e)', () => {
  let app: NestExpressApplication;
  let http: Http;
  let prisma: PrismaService;
  let redis: RedisService;
  let jar: CookieJar;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    jar = new CookieJar();

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
      data: { ownerId, codeHash: sha256Hex(TEST_RECOVERY_CODE.replace(/[^A-Za-z0-9]/g, '').toUpperCase()) },
    });
    await redis.client.flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  it('health endpoints are public', async () => {
    const health = await http.get('/healthz').expect(200);
    expect(health.body.status).toBe('ok');
    const ready = await http.get('/readyz').expect(200);
    expect(ready.body.components).toEqual({ database: 'ok', redis: 'ok' });
  });

  it('session endpoint rejects unauthenticated requests with an Arabic body', async () => {
    const res = await http.get('/api/v1/auth/session').expect(401);
    expect(res.body.code).toBe(ERROR_CODES.UNAUTHORIZED);
    expect(res.body.message).toMatch(/[؀-ۿ]/);
  });

  it('rejects state-changing requests without a CSRF token', async () => {
    await http
      .post('/api/v1/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
      .expect(403)
      .expect((res) => {
        expect(res.body.code).toBe(ERROR_CODES.CSRF_INVALID);
      });
  });

  it('rejects a mismatched CSRF token', async () => {
    const token = await getCsrf(http, jar);
    const res = await postWithCsrf(
      http,
      jar,
      '/api/v1/auth/login',
      { username: TEST_USERNAME, password: 'wrong-password-1' },
      `${token}x`,
    );
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(ERROR_CODES.CSRF_INVALID);
  });

  it('locks the account after 5 failed logins and reports it in Arabic', async () => {
    for (let i = 0; i < 4; i++) {
      const res = await login(http, jar, TEST_USERNAME, `wrong-password-${i}`);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
    }
    const lockRes = await login(http, jar, TEST_USERNAME, 'wrong-password-4');
    expect(lockRes.status).toBe(429);
    expect(lockRes.body.code).toBe(ERROR_CODES.ACCOUNT_LOCKED);
    expect(lockRes.body.message).toMatch(/[؀-ۿ]/);
    expect(lockRes.body.details.retryAfterSeconds).toBeGreaterThan(0);

    const whileLocked = await login(http, jar, TEST_USERNAME, TEST_PASSWORD);
    expect(whileLocked.status).toBe(429);
    expect(whileLocked.body.code).toBe(ERROR_CODES.ACCOUNT_LOCKED);

    const account = await prisma.ownerAccount.findUnique({ where: { username: TEST_USERNAME } });
    expect(account?.failedLoginCount).toBe(5);
    expect(account?.lockedUntil).not.toBeNull();

    const failures = await prisma.auditLog.count({ where: { action: 'auth.login.failed' } });
    const locked = await prisma.auditLog.count({ where: { action: 'auth.login.locked' } });
    expect(failures).toBeGreaterThanOrEqual(5);
    expect(locked).toBeGreaterThanOrEqual(1);
  });

  it('lets the lockout expire (clock advanced in DB) and then logs in with cookie flags intact', async () => {
    await prisma.ownerAccount.update({
      where: { username: TEST_USERNAME },
      data: { lockedUntil: new Date(Date.now() - 1000), failedLoginCount: 0 },
    });

    const res = await login(http, jar, TEST_USERNAME, TEST_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(TEST_USERNAME);

    const setCookies = res.headers['set-cookie'] as unknown as string[];
    const sid = setCookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    const csrf = setCookies.find((c) => c.startsWith(`${CSRF_COOKIE}=`));
    expect(sid).toBeDefined();
    expect(sid).toMatch(/HttpOnly/i);
    expect(sid).toMatch(/Secure/i);
    expect(sid).toMatch(/SameSite=Strict/i);
    expect(sid).toMatch(/Path=\/api/i);
    expect(csrf).toBeDefined();
    expect(csrf).not.toMatch(/HttpOnly/i);
    expect(csrf).toMatch(/SameSite=Strict/i);
    expect(csrf).toMatch(/Secure/i);

    const success = await prisma.auditLog.count({ where: { action: 'auth.login.success' } });
    expect(success).toBeGreaterThanOrEqual(1);
  });

  it('returns the session owner when authenticated', async () => {
    const res = await http.get('/api/v1/auth/session').set('Cookie', jar.header()).expect(200);
    expect(res.body.user.username).toBe(TEST_USERNAME);
  });

  it('requires a CSRF token for logout and revokes the session', async () => {
    await http.post('/api/v1/auth/logout').set('Cookie', jar.header()).expect(403);

    const logoutRes = await postWithCsrf(http, jar, '/api/v1/auth/logout', {});
    expect(logoutRes.status).toBe(200);
    await http.get('/api/v1/auth/session').set('Cookie', jar.header()).expect(401);

    const session = await prisma.ownerSession.findFirst({ where: { revokedAt: { not: null } } });
    expect(session).not.toBeNull();
  });

  it('rate limits repeated login attempts per IP', async () => {
    const ipCandidates = ['::ffff:127.0.0.1', '127.0.0.1', '::1'];
    for (const ip of ipCandidates) {
      await redis.client.set(`rl:login:ip:${ip}`, '30', 'EX', 60);
    }
    try {
      const fresh = new CookieJar();
      const res = await login(http, fresh, TEST_USERNAME, TEST_PASSWORD);
      expect(res.status).toBe(429);
      expect(res.body.code).toBe(ERROR_CODES.RATE_LIMITED);
    } finally {
      for (const ip of ipCandidates) {
        await redis.client.del(`rl:login:ip:${ip}`);
      }
    }
  });

  it('recovers via break-glass code: rotates code, revokes sessions, sets a new password', async () => {
    const preRecovery = new CookieJar();
    const oldSessionRes = await login(http, preRecovery, TEST_USERNAME, TEST_PASSWORD);
    expect(oldSessionRes.status).toBe(200);

    const invalidJar = new CookieJar();
    const invalid = await postWithCsrf(http, invalidJar, '/api/v1/auth/recovery', {
      code: 'DEADBEEF-DEAD-BEEF-DEAD-BEEFDEADBEEF',
      newPassword: 'Another-Pass-2026',
    });
    expect(invalid.status).toBe(401);
    expect(invalid.body.code).toBe(ERROR_CODES.RECOVERY_CODE_INVALID);

    const weak = await postWithCsrf(http, invalidJar, '/api/v1/auth/recovery', {
      code: TEST_RECOVERY_CODE,
      newPassword: 'short',
    });
    expect(weak.status).toBe(422);
    expect(weak.body.code).toBe(ERROR_CODES.PASSWORD_TOO_WEAK);

    const res = await postWithCsrf(http, invalidJar, '/api/v1/auth/recovery', {
      code: TEST_RECOVERY_CODE,
      newPassword: 'Another-Pass-2026',
    });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(TEST_USERNAME);
    expect(res.body.recoveryCode).toBeTruthy();
    expect(res.body.recoveryCode).not.toBe(TEST_RECOVERY_CODE);
    invalidJar.absorb(res);

    await http.get('/api/v1/auth/session').set('Cookie', preRecovery.header()).expect(401);

    const oldPassword = await login(http, new CookieJar(), TEST_USERNAME, TEST_PASSWORD);
    expect(oldPassword.status).toBe(401);

    const newPassword = await login(http, new CookieJar(), TEST_USERNAME, 'Another-Pass-2026');
    expect(newPassword.status).toBe(200);

    const reuse = await postWithCsrf(http, new CookieJar(), '/api/v1/auth/recovery', {
      code: TEST_RECOVERY_CODE,
      newPassword: 'Third-Pass-2026-X',
    });
    expect(reuse.status).toBe(400);
    expect(reuse.body.code).toBe(ERROR_CODES.RECOVERY_CODE_USED);

    const used = await prisma.auditLog.count({ where: { action: 'auth.recovery.used' } });
    expect(used).toBeGreaterThanOrEqual(2);
  });

  it('rejects sessions with an expired idle window', async () => {
    const sessionJar = new CookieJar();
    await login(http, sessionJar, TEST_USERNAME, 'Another-Pass-2026');
    const sid = sessionJar.get(SESSION_COOKIE);
    expect(sid).toBeTruthy();
    await prisma.ownerSession.update({
      where: { tokenHash: sha256Hex(sid!) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await http.get('/api/v1/auth/session').set('Cookie', sessionJar.header()).expect(401);
    expect(res.body.code).toBe(ERROR_CODES.SESSION_EXPIRED);
  });

  it('suspicious CSRF tokens never match random session tokens', async () => {
    const csrf = randomToken(32);
    const res = await http
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrf)
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    expect(res.status).toBe(403);
  });
});

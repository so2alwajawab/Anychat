import 'reflect-metadata';
import argon2 from 'argon2';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.module.js';
import { RedisService } from '../src/common/redis/redis.module.js';
import { serverEnv } from '../src/common/config/env.js';
import { AdminBootstrap } from '../src/modules/admin/admin.bootstrap.js';
import { AUDIT_ACTIONS } from '../src/modules/audit/audit.constants.js';
import {
  CookieJar,
  Http,
  TEST_PASSWORD,
  TEST_USERNAME,
  createTestApp,
  login,
  seedOwner,
} from './helpers.js';

const ADMIN_USERNAME = 'platform-admin';
const OTHER_USERNAME = 'other-tenant';

/**
 * Phase 3 — platform-admin dashboard e2e.
 *
 * Proves: 403 for non-admins, 401 without session, cross-tenant unscoped reads
 * (the admin sees an organization they are NOT a member of), 404 for unknown
 * orgs, and the boot-time promotion from PLATFORM_ADMIN_USERNAMES.
 */
describe('platform admin API (e2e, Phase 3)', () => {
  let app: NestExpressApplication;
  let http: Http;
  let adminJar: CookieJar;
  let memberJar: CookieJar;
  let adminOrgId: string;
  let otherOrgId: string;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    const prisma = app.get(PrismaService);
    const redis = app.get(RedisService);
    await redis.client.flushdb();

    const passwordHash = await argon2.hash(TEST_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE audit_log, password_recovery, owner_session, owner_account, system_setting, membership, organization RESTART IDENTITY CASCADE',
    );

    const adminSeed = await seedOwner(prisma, {
      username: ADMIN_USERNAME,
      passwordHash,
      organizationName: 'Admin Tenant',
    });
    adminOrgId = adminSeed.organizationId;

    const otherSeed = await seedOwner(prisma, {
      username: OTHER_USERNAME,
      passwordHash,
      organizationName: 'Other Tenant',
    });
    otherOrgId = otherSeed.organizationId;

    // Bootstrap runs on API boot with PLATFORM_ADMIN_USERNAMES; the test env
    // leaves it unset, so drive the same code path explicitly.
    (serverEnv as { PLATFORM_ADMIN_USERNAMES?: string }).PLATFORM_ADMIN_USERNAMES =
      ADMIN_USERNAME;
    const bootstrap = app.get(AdminBootstrap);
    await bootstrap.onModuleInit();

    adminJar = new CookieJar();
    expect((await login(http, adminJar, ADMIN_USERNAME, TEST_PASSWORD)).status).toBe(200);
    memberJar = new CookieJar();
    expect((await login(http, memberJar, OTHER_USERNAME, TEST_PASSWORD)).status).toBe(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('session advertises platformAdmin only for the promoted account', async () => {
    const adminSession = await http
      .get('/api/v1/auth/session')
      .set('Cookie', adminJar.header())
      .expect(200);
    expect(adminSession.body.user.platformAdmin).toBe(true);

    const memberSession = await http
      .get('/api/v1/auth/session')
      .set('Cookie', memberJar.header())
      .expect(200);
    expect(memberSession.body.user.platformAdmin).toBe(false);
  });

  it('rejects non-admin sessions with 403 on every admin route', async () => {
    for (const path of [
      '/api/v1/admin/overview',
      '/api/v1/admin/orgs',
      `/api/v1/admin/orgs/${otherOrgId}`,
    ]) {
      const res = await http.get(path).set('Cookie', memberJar.header()).expect(403);
      expect(res.body.code, path).toBe('UNAUTHORIZED');
    }

    // The denial is audited for the attempted cross-tenant read.
    const prisma = app.get(PrismaService);
    const denials = await prisma.auditLog.count({
      where: {
        action: AUDIT_ACTIONS.ADMIN_ACCESS_DENIED,
        entity: 'platform_admin',
        outcome: 'failure',
      },
    });
    expect(denials).toBeGreaterThanOrEqual(3);
  });

  it('rejects anonymous requests with 401', async () => {
    await http.get('/api/v1/admin/overview').expect(401);
    await http.get('/api/v1/admin/orgs').expect(401);
  });

  it('overview aggregates across ALL tenants (unscoped proof)', async () => {
    const res = await http
      .get('/api/v1/admin/overview')
      .set('Cookie', adminJar.header())
      .expect(200);

    expect(res.body.counts.organizations).toBeGreaterThanOrEqual(2);
    expect(res.body.counts.owners).toBeGreaterThanOrEqual(2);
    // The admin is a member of "Admin Tenant" only, yet the newest-organizations
    // list must include the OTHER tenant too.
    const ids = res.body.latestOrgs.map((o: { id: string }) => o.id);
    expect(ids).toContain(otherOrgId);
    expect(Array.isArray(res.body.commentTrend)).toBe(true);
    expect(res.body.commentTrend).toHaveLength(14);
  });

  it('orgs list includes organizations the admin does not belong to', async () => {
    const res = await http
      .get('/api/v1/admin/orgs?limit=50')
      .set('Cookie', adminJar.header())
      .expect(200);

    expect(res.body).toMatchObject({ page: 1, limit: 50 });
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    const ids = res.body.items.map((o: { id: string }) => o.id);
    expect(ids).toContain(otherOrgId);
  });

  it('orgs search matches by organization name and by owner username', async () => {
    const byName = await http
      .get('/api/v1/admin/orgs?q=Other%20Tenant')
      .set('Cookie', adminJar.header())
      .expect(200);
    expect(byName.body.items.map((o: { id: string }) => o.id)).toContain(otherOrgId);

    const byOwner = await http
      .get(`/api/v1/admin/orgs?q=${OTHER_USERNAME}`)
      .set('Cookie', adminJar.header())
      .expect(200);
    expect(byOwner.body.items.map((o: { id: string }) => o.id)).toContain(otherOrgId);
    expect(byOwner.body.items[0].ownerUsername).toBe(OTHER_USERNAME);
  });

  it('org detail exposes another tenant and is audited', async () => {
    const res = await http
      .get(`/api/v1/admin/orgs/${otherOrgId}`)
      .set('Cookie', adminJar.header())
      .expect(200);
    expect(res.body.id).toBe(otherOrgId);
    expect(res.body.name).toBe('Other Tenant');
    expect(res.body.owners[0].user.username).toBe(OTHER_USERNAME);

    const prisma = app.get(PrismaService);
    const viewed = await prisma.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.ADMIN_ORG_VIEWED,
        entityId: otherOrgId,
        organizationId: otherOrgId,
      },
    });
    expect(viewed).not.toBeNull();
  });

  it('org detail 404s for unknown or malformed ids', async () => {
    await http
      .get('/api/v1/admin/orgs/00000000-0000-4000-8000-000000000000')
      .set('Cookie', adminJar.header())
      .expect(404);
    await http
      .get('/api/v1/admin/orgs/not-a-uuid')
      .set('Cookie', adminJar.header())
      .expect(404);
  });

  it('pagination caps limit and honors page offsets', async () => {
    const capped = await http
      .get('/api/v1/admin/orgs?limit=9999')
      .set('Cookie', adminJar.header())
      .expect(400);

    const page2 = await http
      .get('/api/v1/admin/orgs?page=2&limit=1')
      .set('Cookie', adminJar.header())
      .expect(200);
    expect(page2.body.page).toBe(2);
    expect(page2.body.items.length).toBeLessThanOrEqual(1);
    void capped;
  });

  it('bootstrap promotion is idempotent and does not touch other accounts', async () => {
    const prisma = app.get(PrismaService);
    const admin = await prisma.ownerAccount.findUniqueOrThrow({
      where: { username: ADMIN_USERNAME },
    });
    expect(admin.platformRole).toBe('admin');
    const member = await prisma.ownerAccount.findUniqueOrThrow({
      where: { username: OTHER_USERNAME },
    });
    expect(member.platformRole).toBe('member');

    // Re-run: still admin, and only ONE promotion audit exists.
    const bootstrap = app.get(AdminBootstrap);
    await bootstrap.onModuleInit();
    const promotions = await prisma.auditLog.count({
      where: { action: AUDIT_ACTIONS.PLATFORM_ADMIN_PROMOTED, entityId: admin.id },
    });
    expect(promotions).toBe(1);
  });
});

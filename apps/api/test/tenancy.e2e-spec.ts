import 'reflect-metadata';
import argon2 from 'argon2';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { ERROR_CODES } from '@anychat/shared';
import { PrismaService } from '../src/common/prisma/prisma.module.js';
import { RedisService } from '../src/common/redis/redis.module.js';
import {
  CookieJar,
  Http,
  createTestApp,
  login,
  postWithCsrf,
  seedOwner,
} from './helpers.js';

const ORG_A_USER = 'org-a-owner';
const ORG_B_USER = 'org-b-owner';
const PASSWORD = 'TenantIso-2026-Pass';

/**
 * Phase 1 tenancy isolation (e2e).
 *
 * Proves the core SaaS guarantee: two organizations cannot see or touch each
 * other's data. Reads are scoped by the Prisma tenancy extension; writes are
 * stamped with the caller's organization; a cross-tenant GET/PUT/DELETE on a
 * known id answers 404 (never 403, which would leak existence).
 */
describe('tenancy isolation (e2e)', () => {
  let app: NestExpressApplication;
  let http: Http;
  let prisma: PrismaService;

  let jarA: CookieJar;
  let jarB: CookieJar;
  let orgA: string;
  let orgB: string;

  const csrfFor = async (jar: CookieJar): Promise<string> => {
    const res = await http.get('/api/v1/auth/csrf').set('Cookie', jar.header());
    jar.absorb(res);
    return res.body.csrfToken as string;
  };

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    const redis = app.get(RedisService);
    await redis.client.flushdb();

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE comment_event, post, audit_log, webhook_delivery, webhook_subscription, meta_credential, meta_connected_asset, workflow_version, workflow, message_template, execution_run, node_execution, outbound_action, password_recovery, owner_session, owner_account, membership, organization, system_setting RESTART IDENTITY CASCADE',
    );

    const passwordHash = await argon2.hash(PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const a = await seedOwner(prisma, {
      username: ORG_A_USER,
      passwordHash,
      organizationName: 'Org A Workspace',
    });
    const b = await seedOwner(prisma, {
      username: ORG_B_USER,
      passwordHash,
      organizationName: 'Org B Workspace',
    });
    orgA = a.organizationId;
    orgB = b.organizationId;

    jarA = new CookieJar();
    jarB = new CookieJar();
    expect((await login(http, jarA, ORG_A_USER, PASSWORD)).status).toBe(200);
    expect((await login(http, jarB, ORG_B_USER, PASSWORD)).status).toBe(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs up a new customer with their own organization and session', async () => {
    const jar = new CookieJar();
    const csrf = await csrfFor(jar);
    const res = await postWithCsrf(http, jar, '/api/v1/auth/signup', {
      email: 'new@customer.example',
      username: 'newcustomer',
      password: 'SignupPass-2026-XYZ',
      organizationName: 'New Customer Shop',
    }, csrf);

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('newcustomer');

    // The new user belongs to a brand-new organization, not A or B.
    const account = await prisma.ownerAccount.findUnique({
      where: { username: 'newcustomer' },
      include: { memberships: true },
    });
    expect(account?.email).toBe('new@customer.example');
    expect(account?.memberships).toHaveLength(1);
    expect(account?.memberships[0]?.role).toBe('owner');
    expect([orgA, orgB]).not.toContain(account?.memberships[0]?.organizationId);

    // The session cookie was set and /auth/session resolves the same org.
    jar.absorb(res);
    const session = await http.get('/api/v1/auth/session').set('Cookie', jar.header());
    expect(session.status).toBe(200);
    expect(session.body.organizationId).toBe(account?.memberships[0]?.organizationId);
  });

  it('rejects duplicate signup email and username with 409', async () => {
    const jar = new CookieJar();
    const csrf = await csrfFor(jar);

    const dupEmail = await postWithCsrf(http, jar, '/api/v1/auth/signup', {
      email: 'new@customer.example',
      username: 'totally-different',
      password: 'SignupPass-2026-XYZ',
    }, csrf);
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.body.code).toBe(ERROR_CODES.EMAIL_TAKEN);

    const dupUsername = await postWithCsrf(http, jar, '/api/v1/auth/signup', {
      email: 'another@customer.example',
      username: 'newcustomer',
      password: 'SignupPass-2026-XYZ',
    }, csrf);
    expect(dupUsername.status).toBe(409);
    expect(dupUsername.body.code).toBe(ERROR_CODES.USERNAME_TAKEN);
  });

  it('logs in with an email identifier as well as a username', async () => {
    const jar = new CookieJar();
    const res = await login(http, jar, 'new@customer.example', 'SignupPass-2026-XYZ');
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('newcustomer');
  });

  it('isolates templates: A creates, B cannot read/update/delete it', async () => {
    // Org A creates a template.
    const created = await postWithCsrf(http, jarA, '/api/v1/templates', {
      name: 'welcome-a',
      body: 'أهلاً {{commenter_name}}',
    });
    expect(created.status).toBe(201);
    const templateId = created.body.id as string;
    expect(created.body.organizationId).toBe(orgA);

    // Org A sees exactly its own template.
    const listA = await http.get('/api/v1/templates').set('Cookie', jarA.header());
    expect(listA.status).toBe(200);
    const idsA = (listA.body as Array<{ id: string }>).map((t) => t.id);
    expect(idsA).toContain(templateId);

    // Org B's list is empty — A's template never leaks into B.
    const listB = await http.get('/api/v1/templates').set('Cookie', jarB.header());
    expect(listB.status).toBe(200);
    const idsB = (listB.body as Array<{ id: string }>).map((t) => t.id);
    expect(idsB).not.toContain(templateId);

    // Org B cannot GET, PUT, or DELETE A's template by its known id (404).
    const getB = await http.get(`/api/v1/templates/${templateId}`).set('Cookie', jarB.header());
    expect(getB.status).toBe(404);

    const csrfB = await csrfFor(jarB);
    const putB = await http
      .put(`/api/v1/templates/${templateId}`)
      .set('Cookie', jarB.header())
      .set('x-csrf-token', csrfB)
      .send({ name: 'hijacked', body: 'تم اختراق القالب' });
    expect(putB.status).toBe(404);

    const deleteB = await http
      .delete(`/api/v1/templates/${templateId}`)
      .set('Cookie', jarB.header())
      .set('x-csrf-token', csrfB);
    expect(deleteB.status).toBe(404);

    // The template still exists and is untouched for org A.
    const stillThere = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
    expect(stillThere?.name).toBe('welcome-a');
    expect(stillThere?.organizationId).toBe(orgA);
  });

  it('scopes template names per-tenant: same name allowed in two orgs', async () => {
    const csrfA = await csrfFor(jarA);
    const csrfB = await csrfFor(jarB);

    const inA = await postWithCsrf(http, jarA, '/api/v1/templates', {
      name: 'shared-name',
      body: 'قالب المنظمة أ',
    }, csrfA);
    expect(inA.status).toBe(201);

    // The same name in org B must NOT collide — names are unique per org.
    const inB = await postWithCsrf(http, jarB, '/api/v1/templates', {
      name: 'shared-name',
      body: 'قالب المنظمة ب',
    }, csrfB);
    expect(inB.status).toBe(201);
    expect(inB.body.organizationId).toBe(orgB);
  });

  it('isolates workflows: B cannot read or mutate A\'s workflow', async () => {
    const created = await postWithCsrf(http, jarA, '/api/v1/workflows', {
      name: 'flow-a',
    });
    expect(created.status).toBe(201);
    const workflowId = created.body.id as string;
    expect(created.body.organizationId).toBe(orgA);

    // Org B cannot GET or DELETE A's workflow.
    const getB = await http.get(`/api/v1/workflows/${workflowId}`).set('Cookie', jarB.header());
    expect(getB.status).toBe(404);

    const csrfB = await csrfFor(jarB);
    const deleteB = await http
      .delete(`/api/v1/workflows/${workflowId}`)
      .set('Cookie', jarB.header())
      .set('x-csrf-token', csrfB);
    expect(deleteB.status).toBe(404);

    const stillThere = await prisma.workflow.findUnique({ where: { id: workflowId } });
    expect(stillThere?.organizationId).toBe(orgA);

    // Org A can still see it.
    const getA = await http.get(`/api/v1/workflows/${workflowId}`).set('Cookie', jarA.header());
    expect(getA.status).toBe(200);
  });

  it('scopes connected assets per-tenant in the list endpoint', async () => {
    // Seed one asset per org directly (webhook-free).
    const assetA = await prisma.metaConnectedAsset.create({
      data: {
        organizationId: orgA,
        platform: 'facebook',
        externalId: 'page-org-a',
        displayName: 'صفحة أ',
      },
    });
    await prisma.metaConnectedAsset.create({
      data: {
        organizationId: orgB,
        platform: 'facebook',
        externalId: 'page-org-b',
        displayName: 'صفحة ب',
      },
    });

    const listA = await http.get('/api/v1/meta/assets').set('Cookie', jarA.header());
    expect(listA.status).toBe(200);
    const idsA = (listA.body.items as Array<{ id: string }>).map((a) => a.id);
    expect(idsA).toContain(assetA.id);
    expect(idsA).toHaveLength(1); // only org A's asset, never B's
  });

  it('rejects a session whose user has no membership (403)', async () => {
    // Create an account with no organization; the guard must refuse tenant routes.
    const passwordHash = await argon2.hash(PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    await prisma.ownerAccount.create({
      data: { username: 'orphan-user', email: 'orphan@example.com', passwordHash },
    });

    const jar = new CookieJar();
    const res = await login(http, jar, 'orphan-user', PASSWORD);
    expect(res.status).toBe(200); // login itself succeeds…

    // …but any tenant route is refused because there is no membership/org.
    const templates = await http.get('/api/v1/templates').set('Cookie', jar.header());
    expect(templates.status).toBe(403);
  });
});

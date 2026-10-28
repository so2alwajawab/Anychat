import 'reflect-metadata';
import argon2 from 'argon2';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.module.js';
import { RedisService } from '../src/common/redis/redis.module.js';
import {
  CookieJar,
  Http,
  createTestApp,
  getCsrf,
  login,
  seedOwner,
} from './helpers.js';

const USER = 'onboard-owner';
const PASSWORD = 'OnboardPass-2026';
const ORG_NAME = 'مساحة الاختبار';

/**
 * Phase 2 onboarding wizard (e2e).
 *
 * The wizard state lives on the organization: a fresh tenant starts at
 * `welcome`, walks forward (or skips), and reaching `done` completes it —
 * exactly once, with an audit record. Completion is sticky so reviewing an
 * earlier step later never re-triggers first-run behavior.
 */
describe('onboarding (e2e)', () => {
  let app: NestExpressApplication;
  let http: Http;
  let prisma: PrismaService;
  let jar: CookieJar;
  let csrf: string;
  let organizationId: string;

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
    const seeded = await seedOwner(prisma, {
      username: USER,
      passwordHash,
      organizationName: ORG_NAME,
    });
    organizationId = seeded.organizationId;

    jar = new CookieJar();
    expect((await login(http, jar, USER, PASSWORD)).status).toBe(200);
    csrf = await getCsrf(http, jar);
  });

  afterAll(async () => {
    await app.close();
  });

  const putStep = (step: string) =>
    http
      .put('/api/v1/onboarding')
      .set('Cookie', jar.header())
      .set('x-csrf-token', csrf)
      .send({ step });

  it('starts a fresh organization at the welcome step', async () => {
    const res = await http.get('/api/v1/onboarding').set('Cookie', jar.header());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      step: 'welcome',
      completed: false,
      organizationName: ORG_NAME,
    });
  });

  it('requires a session', async () => {
    await http.get('/api/v1/onboarding').expect(401);
    await http.put('/api/v1/onboarding').send({ step: 'done' }).expect(401);
  });

  it('rejects unknown steps with 400', async () => {
    const res = await putStep('skip-everything');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toMatch(/[؀-ۿ]/); // Arabic error contract
  });

  it('walks the wizard to done and completes exactly once with an audit record', async () => {
    const progression = ['connect', 'template', 'done'];
    let expectedStep = 'welcome';
    for (const step of progression) {
      const res = await putStep(step);
      expect(res.status).toBe(200);
      expectedStep = step;
      expect(res.body.step).toBe(expectedStep);
      expect(res.body.completed).toBe(step === 'done');
    }

    // The completion was recorded against the tenant, exactly once.
    const audits = await prisma.auditLog.findMany({
      where: { action: 'onboarding.completed' },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.organizationId).toBe(organizationId);

    const state = await http.get('/api/v1/onboarding').set('Cookie', jar.header());
    expect(state.body.completed).toBe(true);
    expect(state.body.step).toBe('done');
  });

  it('keeps completion sticky when moving back to an earlier step', async () => {
    const res = await putStep('connect');
    expect(res.status).toBe(200);
    expect(res.body.step).toBe('connect');
    expect(res.body.completed).toBe(true);

    // Re-completing later must not duplicate the audit record.
    const doneAgain = await putStep('done');
    expect(doneAgain.body.completed).toBe(true);
    const audits = await prisma.auditLog.count({
      where: { action: 'onboarding.completed' },
    });
    expect(audits).toBe(1);
  });

  it('scopes the wizard to the caller organization', async () => {
    // Another tenant's fresh org is independent: still at welcome.
    const passwordHash = await argon2.hash(PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    const other = await seedOwner(prisma, {
      username: 'onboard-other',
      passwordHash,
      organizationName: 'منظمة أخرى',
    });

    const otherJar = new CookieJar();
    expect((await login(http, otherJar, 'onboard-other', PASSWORD)).status).toBe(200);
    const res = await http.get('/api/v1/onboarding').set('Cookie', otherJar.header());
    expect(res.status).toBe(200);
    expect(res.body.step).toBe('welcome');
    expect(res.body.completed).toBe(false);
    expect(res.body.organizationName).toBe('منظمة أخرى');
    expect(other.organizationId).not.toBe(organizationId);
  });
});

import { createHmac } from 'node:crypto';
import argon2 from 'argon2';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { CSRF_COOKIE } from '@anychat/shared';
import { PrismaService } from '../src/common/prisma/prisma.module.js';
import { RedisService } from '../src/common/redis/redis.module.js';
import { GraphApiError } from '../src/modules/meta/graph.client.js';
import {
  CookieJar,
  Http,
  TEST_PASSWORD,
  TEST_USERNAME,
  createTestApp,
  getCsrf,
  login,
} from './helpers.js';

const TEST_APP_ID = '1234567890';
const TEST_APP_SECRET = 'test-app-secret-0123456789';
const TEST_VERIFY_TOKEN = 'test-verify-token-0123456789';

const PAGE = {
  id: '111',
  name: 'صفحة الاختبار',
  accessToken: 'page-token-aaa',
  tasks: ['CREATE_CONTENT', 'MODERATE', 'MESSAGING'],
};
const IG = { igUserId: '222', username: 'test_ig' };

function makeFakeGraph() {
  const state = { checkResult: 'ok' as 'ok' | '190' };
  return {
    state,
    exchangeShortLived: async () => ({ accessToken: 'short-token' }),
    exchangeLongLived: async () => ({ accessToken: 'long-token' }),
    listPages: async () => [PAGE],
    getPageInstagram: async () => IG,
    subscribePage: async () => ({ success: true }),
    checkAsset: async (externalId: string) => {
      if (state.checkResult === '190') throw new GraphApiError(190, 463, 'token expired');
      return { id: externalId, name: 'ok' };
    },
    listPagePosts: async () => [],
    listPagePostComments: async () => [],
    listInstagramMedia: async () => [],
    listInstagramMediaComments: async () => [],
  };
}

function stateFromLocation(location: string): string {
  return new URL(location).searchParams.get('state') ?? '';
}

function webhookBody(): string {
  return JSON.stringify({
    object: 'page',
    entry: [
      {
        id: '111',
        time: 1700000100,
        changes: [
          { field: 'feed', value: { comment_id: 'c_9', verb: 'add', message: 'مرحبا' } },
        ],
      },
    ],
  });
}

function signWebhook(raw: string, secret = TEST_APP_SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
}

describe('meta connection & webhooks (e2e)', () => {
  let app: NestExpressApplication;
  let http: Http;
  let jar: CookieJar;
  const fake = makeFakeGraph();

  async function csrfJar(): Promise<string> {
    const csrf = jar.get(CSRF_COOKIE) ?? (await getCsrf(http, jar));
    return csrf;
  }

  beforeAll(async () => {
    app = await createTestApp({ graphClient: fake });
    http = request(app.getHttpServer());
    jar = new CookieJar();

    const prisma = app.get(PrismaService);
    const redis = app.get(RedisService);
    await redis.client.flushdb();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE comment_event, post, audit_log, webhook_delivery, webhook_subscription, meta_credential, meta_connected_asset, meta_app_config, password_recovery, owner_session, owner_account, system_setting RESTART IDENTITY CASCADE',
    );
    const passwordHash = await argon2.hash(TEST_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    await prisma.ownerAccount.create({ data: { username: TEST_USERNAME, passwordHash } });
    const loginRes = await login(http, jar, TEST_USERNAME, TEST_PASSWORD);
    expect(loginRes.status).toBe(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires session for config and never echoes secrets', async () => {
    await http.get('/api/v1/meta/config').expect(401);

    const csrf = await csrfJar();
    const putRes = await http
      .put('/api/v1/meta/config')
      .set('Cookie', jar.header())
      .set('x-csrf-token', csrf)
      .send({
        appId: TEST_APP_ID,
        appSecret: TEST_APP_SECRET,
        webhookVerifyToken: TEST_VERIFY_TOKEN,
      })
      .expect(200);
    expect(putRes.body.hasAppSecret).toBe(true);
    expect(putRes.body.hasVerifyToken).toBe(true);
    expect(putRes.body.appId).toBe(TEST_APP_ID);
    expect(putRes.body.redirectUri).toContain('/api/v1/meta/oauth/callback');
    expect(putRes.body.webhookCallbackUrl).toContain('/api/v1/webhooks/meta');

    const getRes = await http
      .get('/api/v1/meta/config')
      .set('Cookie', jar.header())
      .expect(200);
    const serialized = JSON.stringify(getRes.body);
    expect(serialized).not.toContain(TEST_APP_SECRET);
    expect(serialized).not.toContain(TEST_VERIFY_TOKEN);
    expect(serialized).not.toContain('appSecretCipher');
  });

  it('oauth/start redirects to Facebook with scope, state and PKCE', async () => {
    const res = await http
      .get('/api/v1/meta/oauth/start')
      .set('Cookie', jar.header())
      .expect(302);
    const location = String(res.headers.location);
    expect(location).toContain('https://www.facebook.com/');
    expect(location).toContain('/dialog/oauth');
    const url = new URL(location);
    expect(url.searchParams.get('client_id')).toBe(TEST_APP_ID);
    expect(url.searchParams.get('redirect_uri')).toContain('/api/v1/meta/oauth/callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const scope = url.searchParams.get('scope') ?? '';
    for (const perm of [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_engagement',
      'pages_manage_metadata',
      'pages_messaging',
    ]) {
      expect(scope).toContain(perm);
    }
    expect(stateFromLocation(location)).toBeTruthy();
    const setCookies = res.headers['set-cookie'];
    const cookieList = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];
    expect(cookieList.some((c) => c.startsWith('anychat_oauth='))).toBe(true);
  });

  it('oauth/callback discovers pages + IG assets with encrypted credentials and subscriptions', async () => {
    const startRes = await http
      .get('/api/v1/meta/oauth/start')
      .set('Cookie', jar.header())
      .expect(302);
    const state = stateFromLocation(String(startRes.headers.location));
    jar.absorb(startRes);

    const callbackRes = await http
      .get(`/api/v1/meta/oauth/callback?code=auth-code-1&state=${state}`)
      .set('Cookie', jar.header())
      .expect(302);
    expect(String(callbackRes.headers.location)).toContain('/connections?oauth=success');

    const assetsRes = await http
      .get('/api/v1/meta/assets')
      .set('Cookie', jar.header())
      .expect(200);
    const items = assetsRes.body.items as Array<{
      id: string;
      platform: string;
      externalId: string;
      linkedPageId?: string | null;
      connectionStatus?: string;
      selected?: boolean;
      credential?: { status: string } | null;
    }>;
    const fb = items.find((a) => a.platform === 'facebook');
    const ig = items.find((a) => a.platform === 'instagram');
    expect(fb?.externalId).toBe('111');
    expect(fb?.credential?.status).toBe('active');
    expect(ig?.externalId).toBe('222');
    expect(ig?.linkedPageId).toBe('111');
    expect(JSON.stringify(assetsRes.body)).not.toContain('page-token-aaa');

    const prisma = app.get(PrismaService);
    const creds = await prisma.metaCredential.findMany();
    expect(creds).toHaveLength(2);
    for (const cred of creds) {
      expect(cred.ciphertext).not.toContain('page-token-aaa');
      expect(cred.keyVersion).toBe('v1');
    }

    const subs = await prisma.webhookSubscription.findMany();
    const pageSub = subs.find((s) => s.object === 'page');
    const igSub = subs.find((s) => s.object === 'instagram');
    expect(pageSub?.subscriptionStatus).toBe('active');
    expect(igSub?.subscriptionStatus).toBe('dashboard_required');
  });

  it('oauth/callback rejects missing, forged and replayed state', async () => {
    await http.get('/api/v1/meta/oauth/callback?code=x').expect(400);

    const forged = await http
      .get('/api/v1/meta/oauth/callback?code=x&state=forged-state-value')
      .set('Cookie', 'anychat_oauth=forged-state-value')
      .expect(400);
    expect(forged.body.code).toBe('OAUTH_STATE_INVALID');

    const startRes = await http
      .get('/api/v1/meta/oauth/start')
      .set('Cookie', jar.header())
      .expect(302);
    const state = stateFromLocation(String(startRes.headers.location));
    jar.absorb(startRes);
    await http
      .get(`/api/v1/meta/oauth/callback?code=auth-code-2&state=${state}`)
      .set('Cookie', jar.header())
      .expect(302);
    const replay = await http
      .get(`/api/v1/meta/oauth/callback?code=auth-code-2&state=${state}`)
      .set('Cookie', jar.header())
      .expect(400);
    expect(replay.body.code).toBe('OAUTH_STATE_INVALID');
  });

  it('webhook verification handshake echoes the challenge only for the right token', async () => {
    const ok = await http
      .get(
        `/api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=challenge-123`,
      )
      .expect(200);
    expect(ok.text).toBe('challenge-123');

    const bad = await http
      .get(
        '/api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=challenge-123',
      )
      .expect(403);
    expect(bad.body.code).toBe('WEBHOOK_VERIFY_FAILED');

    await http.get('/api/v1/webhooks/meta?hub.mode=subscribe').expect(400);
  });

  it('webhook POST stores deliveries, dedupes repeats, rejects bad signatures', async () => {
    const prisma = app.get(PrismaService);
    const raw = webhookBody();

    const accepted = await http
      .post('/api/v1/webhooks/meta')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', signWebhook(raw))
      .send(raw)
      .expect(200);
    expect(accepted.body as Record<string, unknown>).toMatchObject({
      status: 'accepted',
      accepted: 1,
      duplicates: 0,
    });

    const repeat = await http
      .post('/api/v1/webhooks/meta')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', signWebhook(raw))
      .send(raw)
      .expect(200);
    expect(repeat.body as Record<string, unknown>).toMatchObject({
      accepted: 0,
      duplicates: 1,
    });

    expect(await prisma.webhookDelivery.count()).toBe(1);

    const badSig = await http
      .post('/api/v1/webhooks/meta')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', signWebhook(raw, 'wrong-secret'))
      .send(raw)
      .expect(401);
    expect(badSig.body.code).toBe('WEBHOOK_SIGNATURE_INVALID');

    await http
      .post('/api/v1/webhooks/meta')
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(401);

    expect(await prisma.webhookDelivery.count()).toBe(1);
  });

  it('health detects token 190 and flags reauth_required; reconnect flow restores via OAuth', async () => {
    const assetsRes = await http
      .get('/api/v1/meta/assets')
      .set('Cookie', jar.header())
      .expect(200);
    const fb = (assetsRes.body.items as Array<{ id: string; platform: string }>).find(
      (a) => a.platform === 'facebook',
    )!;

    fake.state.checkResult = '190';
    const health = await http
      .get(`/api/v1/meta/assets/${fb.id}/health`)
      .set('Cookie', jar.header())
      .expect(200);
    expect(health.body).toMatchObject({ ok: false, code: 190 });

    const after = await http
      .get('/api/v1/meta/assets')
      .set('Cookie', jar.header())
      .expect(200);
    const flagged = (after.body.items as Array<{ id: string; connectionStatus: string }>).find(
      (a) => a.id === fb.id,
    );
    expect(flagged?.connectionStatus).toBe('reauth_required');

    const reconnect = await http
      .post(`/api/v1/meta/assets/${fb.id}/reconnect`)
      .set('Cookie', jar.header())
      .set('x-csrf-token', (await csrfJar()) as string)
      .send({})
      .expect(200);
    expect(reconnect.body.redirectUrl).toContain('/api/v1/meta/oauth/start');

    fake.state.checkResult = 'ok';
    const startRes = await http
      .get('/api/v1/meta/oauth/start')
      .set('Cookie', jar.header())
      .expect(302);
    const state = stateFromLocation(String(startRes.headers.location));
    jar.absorb(startRes);
    await http
      .get(`/api/v1/meta/oauth/callback?code=auth-code-3&state=${state}`)
      .set('Cookie', jar.header())
      .expect(302);

    const restored = await http
      .get('/api/v1/meta/assets')
      .set('Cookie', jar.header())
      .expect(200);
    const restoredFb = (restored.body.items as Array<{ id: string; connectionStatus: string }>).find(
      (a) => a.id === fb.id,
    );
    expect(restoredFb?.connectionStatus).toBe('connected');
  });

  it('select/unselect and delete asset lifecycle', async () => {
    const assetsRes = await http
      .get('/api/v1/meta/assets')
      .set('Cookie', jar.header())
      .expect(200);
    const ig = (assetsRes.body.items as Array<{ id: string; platform: string }>).find(
      (a) => a.platform === 'instagram',
    )!;

    const csrf = await csrfJar();
    const selected = await http
      .post(`/api/v1/meta/assets/${ig.id}/select`)
      .set('Cookie', jar.header())
      .set('x-csrf-token', csrf)
      .send({ selected: true })
      .expect(200);
    expect(selected.body.selected).toBe(true);

    const unselected = await http
      .post(`/api/v1/meta/assets/${ig.id}/select`)
      .set('Cookie', jar.header())
      .set('x-csrf-token', csrf)
      .send({ selected: false })
      .expect(200);
    expect(unselected.body.selected).toBe(false);

    await http
      .delete(`/api/v1/meta/assets/${ig.id}`)
      .set('Cookie', jar.header())
      .set('x-csrf-token', csrf)
      .expect(200);

    const after = await http
      .get('/api/v1/meta/assets')
      .set('Cookie', jar.header())
      .expect(200);
    expect((after.body.items as Array<{ id: string }>).some((a) => a.id === ig.id)).toBe(false);

    await http
      .delete('/api/v1/meta/assets/does-not-exist')
      .set('Cookie', jar.header())
      .set('x-csrf-token', csrf)
      .expect(404);
  });

  it('diagnostics exposes subscriptions, last event and signature failure counters', async () => {
    const res = await http
      .get('/api/v1/meta/webhooks/diagnostics')
      .set('Cookie', jar.header())
      .expect(200);
    expect(res.body.signatureFailures.total).toBeGreaterThanOrEqual(2);
    expect(res.body.signatureFailures.last24h).toBeGreaterThanOrEqual(2);
    expect(res.body.lastEventAt).toBeTruthy();
    const subs = res.body.subscriptions as Array<{ object: string; assetName: string }>;
    expect(subs.some((s) => s.object === 'page')).toBe(true);
    expect(subs.some((s) => s.object === 'instagram')).toBe(false);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(TEST_APP_SECRET);
    expect(serialized).not.toContain('page-token-aaa');
  });
});

import 'reflect-metadata';
import argon2 from 'argon2';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod, type Type } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { CSRF_COOKIE } from '@anychat/shared';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator.js';
import { PrismaService } from '../src/common/prisma/prisma.module.js';
import { RedisService } from '../src/common/redis/redis.module.js';
import { sha256Hex } from '../src/common/crypto/hash.js';
import {
  CookieJar,
  Http,
  TEST_PASSWORD,
  TEST_USERNAME,
  createTestApp,
  login,
  seedOwner,
} from './helpers.js';

interface RouteInfo {
  httpMethod: string;
  path: string;
  isPublic: boolean;
}

function normalizePath(...parts: string[]): string {
  return parts
    .join('/')
    .split('/')
    .filter((s) => s.length > 0)
    .join('/');
}

function discoverRoutes(app: NestExpressApplication): RouteInfo[] {
  const modules = app.get(ModulesContainer);
  const routes: RouteInfo[] = [];
  for (const moduleRef of modules.values()) {
    for (const wrapper of moduleRef.controllers.values()) {
      const cls = wrapper.metatype as Type<unknown>;
      if (!cls) continue;
      const ctrlPath = String(Reflect.getMetadata(PATH_METADATA, cls) ?? '');
      const ctrlIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, cls) === true;
      for (const name of Object.getOwnPropertyNames(cls.prototype ?? {})) {
        if (name === 'constructor') continue;
        const handler = (cls.prototype as Record<string, unknown>)[name];
        if (typeof handler !== 'function') continue;
        const methodValue: RequestMethod | undefined = Reflect.getMetadata(METHOD_METADATA, handler);
        if (methodValue === undefined) continue;
        const httpMethod = RequestMethod[methodValue];
        if (!httpMethod || httpMethod === 'ALL' || httpMethod === 'SEARCH') continue;
        const handlerPath = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
        const joined = normalizePath(ctrlPath, handlerPath);
        const isPublic =
          ctrlIsPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
        const path =
          joined === 'healthz' || joined === 'readyz' ? `/${joined}` : `/api/v1/${joined}`;
        routes.push({ httpMethod, path, isPublic });
      }
    }
  }
  return routes;
}

const EXPECTED_ROUTES: RouteInfo[] = [
  { httpMethod: 'GET', path: '/healthz', isPublic: true },
  { httpMethod: 'GET', path: '/readyz', isPublic: true },
  { httpMethod: 'GET', path: '/api/v1/auth/csrf', isPublic: true },
  { httpMethod: 'POST', path: '/api/v1/auth/signup', isPublic: true },
  { httpMethod: 'POST', path: '/api/v1/auth/login', isPublic: true },
  { httpMethod: 'POST', path: '/api/v1/auth/recovery', isPublic: true },
  { httpMethod: 'POST', path: '/api/v1/auth/logout', isPublic: true },
  { httpMethod: 'GET', path: '/api/v1/auth/session', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/audit', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/onboarding', isPublic: false },
  { httpMethod: 'PUT', path: '/api/v1/onboarding', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/meta/config', isPublic: false },
  { httpMethod: 'PUT', path: '/api/v1/meta/config', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/meta/oauth/start', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/meta/oauth/callback', isPublic: true },
  { httpMethod: 'GET', path: '/api/v1/meta/assets', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/meta/assets/:id/health', isPublic: false },
  { httpMethod: 'POST', path: '/api/v1/meta/assets/:id/select', isPublic: false },
  { httpMethod: 'DELETE', path: '/api/v1/meta/assets/:id', isPublic: false },
  { httpMethod: 'POST', path: '/api/v1/meta/assets/:id/reconnect', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/meta/webhooks/diagnostics', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/meta/webhooks/deliveries', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/content/posts', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/content/comments', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/content/comments/:id', isPublic: false },
  { httpMethod: 'POST', path: '/api/v1/content/sync', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/templates', isPublic: false },
  { httpMethod: 'POST', path: '/api/v1/templates', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/templates/:id', isPublic: false },
  { httpMethod: 'PUT', path: '/api/v1/templates/:id', isPublic: false },
  { httpMethod: 'DELETE', path: '/api/v1/templates/:id', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/workflows', isPublic: false },
  { httpMethod: 'POST', path: '/api/v1/workflows', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/workflows/:id', isPublic: false },
  { httpMethod: 'PUT', path: '/api/v1/workflows/:id', isPublic: false },
  { httpMethod: 'POST', path: '/api/v1/workflows/:id/publish', isPublic: false },
  { httpMethod: 'POST', path: '/api/v1/workflows/:id/pause', isPublic: false },
  { httpMethod: 'POST', path: '/api/v1/workflows/:id/resume', isPublic: false },
  { httpMethod: 'DELETE', path: '/api/v1/workflows/:id', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/workflows/:id/versions', isPublic: false },
  { httpMethod: 'POST', path: '/api/v1/workflows/:id/test-run', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/runs', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/runs/:id', isPublic: false },
  { httpMethod: 'POST', path: '/api/v1/runs/:id/retry', isPublic: false },
  { httpMethod: 'GET', path: '/api/v1/webhooks/meta', isPublic: true },
  { httpMethod: 'POST', path: '/api/v1/webhooks/meta', isPublic: true },
];

/**
 * The webhook surface is HMAC-authenticated, not session/CSRF-authenticated:
 * it is excluded from the generic 401/CSRF/status assertions and covered by
 * dedicated webhook tests instead.
 */
const isHmacRoute = (route: RouteInfo) => route.path.startsWith('/api/v1/webhooks/');

/** Routes that may answer 302 (OAuth redirect) or 503 (not configured). */
const SESSION_STATUS_ALLOWANCE: Record<string, number[]> = {
  'GET /api/v1/meta/oauth/start': [200, 302, 503],
};

function allowedStatuses(route: RouteInfo): number[] {
  const key = routeKey(route);
  if (SESSION_STATUS_ALLOWANCE[key]) return SESSION_STATUS_ALLOWANCE[key];
  const allowed = [200];
  // Missing entities legitimately answer 404 (path params are substituted with
  // a non-existent UUID by send()).
  if (route.path.includes(':')) allowed.push(404);
  // The matrix sends empty bodies everywhere; DTO validation rejecting one with
  // 400 is correct behaviour, not an authorization defect.
  if (route.httpMethod !== 'GET') allowed.push(400);
  return allowed;
}

const routeKey = (r: RouteInfo) => `${r.httpMethod} ${r.path}`;

/**
 * Path parameters are swapped for a syntactically valid, non-existent UUID so
 * each handler actually runs (auth passes, lookup misses) and answers 404.
 * Requesting the literal `:id` instead trips ParseUUIDPipe with a 400, which
 * would prove nothing about the route beyond validation.
 */
const NON_EXISTENT_UUID = '00000000-0000-4000-8000-000000000000';

function send(
  http: Http,
  route: RouteInfo,
  opts: { cookies?: string; csrf?: string },
) {
  const method = route.httpMethod.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete';
  const path = route.path.replace(/:[A-Za-z0-9_]+/g, NON_EXISTENT_UUID);
  let req = http[method](path);
  if (opts.cookies) req = req.set('Cookie', opts.cookies);
  if (opts.csrf) req = req.set('x-csrf-token', opts.csrf);
  if (route.httpMethod !== 'GET') req = req.send({});
  return req;
}

describe('authorization matrix (e2e)', () => {
  let app: NestExpressApplication;
  let http: Http;
  let routes: RouteInfo[];
  let jar: CookieJar;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    routes = discoverRoutes(app);
    jar = new CookieJar();

    const prisma = app.get(PrismaService);
    const redis = app.get(RedisService);
    await redis.client.flushdb();

    const passwordHash = await argon2.hash(TEST_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    const { ownerId } = await seedOwner(prisma, {
      username: TEST_USERNAME,
      passwordHash,
      upsert: true,
    });
    await prisma.passwordRecovery.deleteMany({ where: { ownerId } });
    await prisma.passwordRecovery.create({
      data: { ownerId, codeHash: sha256Hex('0123456789ABCDEF0123456789ABCDEF') },
    });
    await prisma.$executeRawUnsafe('DELETE FROM owner_session');
  });
  afterAll(async () => {
    await app.close();
  });

  it('discovers exactly the expected route inventory (100% coverage)', () => {
    const actual = routes.map(routeKey).sort();
    const expected = EXPECTED_ROUTES.map(routeKey).sort();
    expect(actual).toEqual(expected);
    for (const expectedRoute of EXPECTED_ROUTES) {
      const match = routes.find((r) => routeKey(r) === routeKey(expectedRoute));
      expect(match?.isPublic, routeKey(expectedRoute)).toBe(expectedRoute.isPublic);
    }
  });

  it('returns 401 for every non-public route without a session', async () => {
    const protectedRoutes = routes.filter((r) => !r.isPublic && !isHmacRoute(r));
    expect(protectedRoutes.length).toBeGreaterThan(0);
    for (const route of protectedRoutes) {
      const res = await send(http, route, {});
      expect(res.status, `${routeKey(route)} must be 401 without session`).toBe(401);
      expect(res.body.code, routeKey(route)).toBe('UNAUTHORIZED');
    }
  });

  it('never returns 401 for public routes; unsafe public routes require CSRF', async () => {
    const publicRoutes = routes.filter((r) => r.isPublic && !isHmacRoute(r));
    for (const route of publicRoutes) {
      const res = await send(http, route, {});
      expect(res.status, routeKey(route)).not.toBe(401);
      if (route.httpMethod !== 'GET') {
        expect(res.status, `${routeKey(route)} must reject missing CSRF`).toBe(403);
        expect(res.body.code, routeKey(route)).toBe('CSRF_INVALID');
      }
    }
  });

  it('every route responds normally with a valid session and CSRF token; logout revokes last', async () => {
    const loginRes = await login(http, jar, TEST_USERNAME, TEST_PASSWORD);
    expect(loginRes.status, 'seed login').toBe(200);
    const cookies = jar.header();
    const csrf = jar.get(CSRF_COOKIE);
    expect(csrf).toBeTruthy();

    const logoutRoute = routes.find((r) => r.path === '/api/v1/auth/logout');
    expect(logoutRoute).toBeDefined();

    for (const route of routes) {
      if (routeKey(route) === routeKey(logoutRoute!)) continue;
      if (isHmacRoute(route)) continue;
      const res = await send(http, route, { cookies, csrf });
      expect(res.status, `${routeKey(route)} must not be 401 with session`).not.toBe(401);
      if (!route.isPublic) {
        expect(allowedStatuses(route), `${routeKey(route)} got ${res.status}`).toContain(res.status);
      }
    }

    const logoutRes = await send(http, logoutRoute!, { cookies, csrf });
    expect(logoutRes.status, 'logout').toBe(200);
    const sessionAfter = await send(http, { httpMethod: 'GET', path: '/api/v1/auth/session', isPublic: false }, { cookies });
    expect(sessionAfter.status, 'session revoked after logout').toBe(401);
  });
});

import cookieParser from 'cookie-parser';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { CSRF_COOKIE } from '@anychat/shared';
import { AppModule } from '../src/app.module.js';
import { GraphClient } from '../src/modules/meta/graph.client.js';

export const TEST_USERNAME = 'owner';
export const TEST_PASSWORD = 'MetaDev-2026-Chat';
export const TEST_RECOVERY_CODE = '01234567-89AB-CDEF-0123-456789ABCDEF';

export type Http = ReturnType<typeof request>;

export async function createTestApp(options?: {
  graphClient?: Partial<GraphClient>;
}): Promise<NestExpressApplication> {
  let moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  if (options?.graphClient) {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GraphClient)
      .useValue(options.graphClient)
      .compile();
  }
  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1', { exclude: ['healthz', 'readyz'] });
  await app.init();
  return app;
}

export class CookieJar {
  private readonly store = new Map<string, string>();

  absorb(res: request.Response): void {
    const raw = res.headers['set-cookie'] as string[] | string | undefined;
    if (!raw) return;
    for (const cookie of Array.isArray(raw) ? raw : [raw]) {
      const pair = cookie.split(';')[0] ?? '';
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (value === '') this.store.delete(name);
      else this.store.set(name, value);
    }
  }

  header(): string {
    return [...this.store.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  get(name: string): string | undefined {
    return this.store.get(name);
  }
}

export async function getCsrf(http: Http, jar: CookieJar): Promise<string> {
  const res = await http.get('/api/v1/auth/csrf').set('Cookie', jar.header());
  jar.absorb(res);
  return res.body.csrfToken as string;
}

export async function postWithCsrf(
  http: Http,
  jar: CookieJar,
  path: string,
  body: unknown,
  csrfOverride?: string,
): Promise<request.Response> {
  const csrf = csrfOverride ?? jar.get(CSRF_COOKIE) ?? (await getCsrf(http, jar));
  return http
    .post(path)
    .set('Cookie', jar.header())
    .set('x-csrf-token', csrf)
    .send(body as object);
}

export async function login(
  http: Http,
  jar: CookieJar,
  username: string,
  password: string,
): Promise<request.Response> {
  const res = await postWithCsrf(http, jar, '/api/v1/auth/login', { username, password });
  jar.absorb(res);
  return res;
}

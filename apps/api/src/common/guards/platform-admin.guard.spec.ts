import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HttpException,
  InternalServerErrorException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformAdminGuard } from './platform-admin.guard.js';
import {
  PLATFORM_ADMIN_ONLY_KEY,
  UNSCOPED_KEY,
} from '../decorators/platform-admin.decorator.js';
import { AUDIT_ACTIONS } from '../../modules/audit/audit.constants.js';

function ctxWith(meta: Record<string, boolean>, req: unknown): ExecutionContext {
  const handler = () => {};
  const cls = () => {};
  const metaMap = new Map(Object.entries(meta));
  const reflector = {
    getAllAndOverride: (key: string) => metaMap.get(key),
  } as unknown as Reflector;
  return {
    getHandler: () => handler,
    getClass: () => cls,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
    reflector,
  } as unknown as ExecutionContext & { reflector: Reflector };
}

describe('PlatformAdminGuard (Phase 3)', () => {
  let guard: PlatformAdminGuard;
  let audit: { record: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    audit = { record: vi.fn().mockResolvedValue(undefined) };
  });

  function makeGuard(meta: Record<string, boolean>, req: unknown) {
    const context = ctxWith(meta, req);
    // The guard resolves Reflector via DI; rebuild it with the stubbed one.
    guard = new PlatformAdminGuard(
      (context as unknown as { reflector: Reflector }).reflector,
      audit as never,
    );
    return context;
  }

  it('passes routes without platform-admin metadata', async () => {
    const context = makeGuard({}, { session: { platformAdmin: false } });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('allows platform admins through', async () => {
    const context = makeGuard(
      { [PLATFORM_ADMIN_ONLY_KEY]: true },
      { session: { platformAdmin: true, ownerId: 'o-1' } },
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('403s non-admins and audits the denial', async () => {
    const req = { session: { platformAdmin: false, ownerId: 'o-2' }, url: '/api/v1/admin/overview' };
    const context = makeGuard({ [PLATFORM_ADMIN_ONLY_KEY]: true }, req);

    const caught = await guard.canActivate(context).catch((e: unknown) => e);
    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(403);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.ADMIN_ACCESS_DENIED,
        actorId: 'o-2',
        outcome: 'failure',
      }),
      req,
    );
  });

  it('500s when a route is unscoped but not admin-gated (misconfiguration)', async () => {
    const context = makeGuard(
      { [UNSCOPED_KEY]: true },
      { session: { platformAdmin: true } },
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('allows unscoped + admin-gated routes for admins', async () => {
    const context = makeGuard(
      { [UNSCOPED_KEY]: true, [PLATFORM_ADMIN_ONLY_KEY]: true },
      { session: { platformAdmin: true, ownerId: 'o-1' } },
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('403s unscoped routes for non-admins (defense in depth)', async () => {
    const context = makeGuard(
      { [UNSCOPED_KEY]: true, [PLATFORM_ADMIN_ONLY_KEY]: true },
      { session: { platformAdmin: false, ownerId: 'o-3' }, url: '/api/v1/admin/orgs' },
    );
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 });
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
});

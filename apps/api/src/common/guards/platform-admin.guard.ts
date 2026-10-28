import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ERROR_CODES, apiError } from '@anychat/shared';
import {
  PLATFORM_ADMIN_ONLY_KEY,
  UNSCOPED_KEY,
} from '../decorators/platform-admin.decorator.js';
import { AUDIT_ACTIONS } from '../../modules/audit/audit.constants.js';
import { AuditService } from '../../modules/audit/audit.service.js';

/**
 * Phase 3 — platform-admin authorization. Registered as a global APP_GUARD
 * AFTER AdminAuthGuard, so `req.session` is always populated here for
 * authenticated (non-`@Public`) routes.
 *
 * Policy:
 * - Routes without `@PlatformAdminOnly()` pass through untouched.
 * - `@Unscoped()` without `@PlatformAdminOnly()` is a programming error (it
 *   would expose cross-tenant data) and fails with a 500.
 * - Denied access is audited (`admin.access.denied`) with the actor and path.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const [handler, cls] = [context.getHandler(), context.getClass()];
    const isUnscoped = this.reflector.getAllAndOverride<boolean>(UNSCOPED_KEY, [
      handler,
      cls,
    ]);
    const requiresPlatformAdmin = this.reflector.getAllAndOverride<boolean>(
      PLATFORM_ADMIN_ONLY_KEY,
      [handler, cls],
    );

    if (isUnscoped && !requiresPlatformAdmin) {
      throw new InternalServerErrorException(
        apiError(500, ERROR_CODES.INTERNAL_ERROR),
      );
    }
    if (!requiresPlatformAdmin) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (req.session?.platformAdmin) return true;

    await this.audit.record(
      {
        action: AUDIT_ACTIONS.ADMIN_ACCESS_DENIED,
        actorId: req.session?.ownerId ?? null,
        entity: 'platform_admin',
        outcome: 'failure',
        meta: { path: req.url },
      },
      req,
    );
    throw new HttpException(apiError(403, ERROR_CODES.UNAUTHORIZED), 403);
  }
}

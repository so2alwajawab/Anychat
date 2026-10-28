import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { runWithOrg } from '../tenancy/org-context.js';

/**
 * Binds the tenant resolved by AdminAuthGuard onto the AsyncLocalStorage store
 * for the duration of the request handler, so the Prisma tenancy extension can
 * auto-scope every query on a tenant-owned model.
 *
 * Runs after guards, so `req.organizationId` is already populated for
 * authenticated routes. Public routes (webhooks, OAuth, login/signup) have no
 * `organizationId` and therefore run with no store — their writes set
 * organizationId explicitly.
 */
@Injectable()
export class OrgContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const organizationId = req.organizationId;
    if (!organizationId) return next.handle();

    // Re-subscribe inside runWithOrg so the ALS store spans the whole handler
    // chain (including async work), not just the Observable construction.
    return new Observable((subscriber) => {
      runWithOrg(organizationId, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}

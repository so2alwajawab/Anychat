import { HttpException } from '@nestjs/common';
import { ERROR_CODES, apiError } from '@anychat/shared';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request tenant context.
 *
 * The active organization is stored in an AsyncLocalStorage store so that any
 * code running inside a request (services, repositories, nested awaits) can
 * read it without threading `organizationId` through every call site. The
 * Prisma tenancy extension reads it to auto-scope every query on a
 * tenant-owned model.
 *
 * Background jobs (BullMQ workers) and public routes (Meta webhooks, OAuth
 * callbacks) run with NO store; those code paths must set `organizationId`
 * explicitly on every write.
 */
interface OrgStore {
  organizationId: string;
}

const orgStorage = new AsyncLocalStorage<OrgStore>();

/** Runs `fn` with `organizationId` active for the current async context. */
export function runWithOrg<T>(organizationId: string, fn: () => T): T {
  return orgStorage.run({ organizationId }, fn);
}

/**
 * The organizationId of the active request context, or `undefined` when running
 * outside any scoped context (background job / public webhook).
 */
export function currentOrgId(): string | undefined {
  return orgStorage.getStore()?.organizationId;
}

/**
 * The active request's organizationId, or a 403 if there is none. Used by
 * request-path code to stamp `organizationId` on writes explicitly — the tenancy
 * extension also injects it, but making it explicit satisfies the compiler and
 * keeps intent clear.
 */
export function requireOrgId(): string {
  const orgId = orgStorage.getStore()?.organizationId;
  if (!orgId) {
    // No tenant context: this code ran outside an authenticated request. Refuse
    // rather than write an unscoped (or wrongly scoped) row.
    throw new HttpException(apiError(403, ERROR_CODES.UNAUTHORIZED), 403);
  }
  return orgId;
}

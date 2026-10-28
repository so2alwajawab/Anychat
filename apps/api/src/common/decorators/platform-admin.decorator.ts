import { SetMetadata } from '@nestjs/common';

/**
 * Phase 3 — platform-admin (cross-tenant) route markers.
 *
 * PLATFORM_ADMIN_ONLY: route requires OwnerAccount.platformRole === 'admin'.
 *   Enforced by the global PlatformAdminGuard (after AdminAuthGuard, so a
 *   live session always exists when it runs).
 *
 * UNSCOPED: route intentionally runs WITHOUT tenant context — the
 * OrgContextInterceptor skips binding the AsyncLocalStorage store, so Prisma
 * queries in the handler see ALL organizations. Every `@Unscoped()` route
 * MUST also carry `@PlatformAdminOnly()` (the guard 500s otherwise), because
 * an unscoped, non-admin-gated handler would leak cross-tenant data.
 */
export const PLATFORM_ADMIN_ONLY_KEY = 'platformAdminOnly';
export const UNSCOPED_KEY = 'unscoped';

/** Marks a route/class as requiring platform-admin authorization. */
export const PlatformAdminOnly = () => SetMetadata(PLATFORM_ADMIN_ONLY_KEY, true);

/** Marks a route/class as bypassing tenant scoping (admin-only by contract). */
export const Unscoped = () => SetMetadata(UNSCOPED_KEY, true);

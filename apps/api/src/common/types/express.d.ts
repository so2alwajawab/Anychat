import 'express';

export interface AuthenticatedSession {
  id: string;
  ownerId: string;
  username: string;
  csrfTokenHash: string | null;
  /** Platform-wide admin flag (Phase 3): gates the cross-tenant /admin API. */
  platformAdmin: boolean;
  createdAt: Date;
  absoluteExpiresAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      session?: AuthenticatedSession;
      /**
       * Tenant resolved from the session's membership by AdminAuthGuard. Populated
       * on every authenticated request; absent on `@Public()` routes (webhooks,
       * OAuth callbacks, login/signup) which run without tenant context.
       */
      organizationId?: string;
      csrfToken?: string;
      rawBody?: Buffer;
    }
  }
}

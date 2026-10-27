import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { CSRF_COOKIE, ERROR_CODES, apiError, timingSafeEqualString } from '@anychat/shared';
import { sha256Hex } from '../crypto/hash.js';
import { PrismaService } from '../prisma/prisma.module.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The Meta webhook receiver is the only unauthenticated write surface; it is
 * HMAC-authenticated instead of CSRF-authenticated (Phase 0 §7.3).
 */
const CSRF_EXEMPT_PATHS = ['/api/v1/webhooks/meta'];

/**
 * Double-submit CSRF: every state-changing API call must present a
 * `X-CSRF-Token` header matching the `anychat_csrf` cookie. When the request
 * also carries a session, the token must additionally match the value bound to
 * that session at login time (session-bound double-submit).
 *
 * Runs AFTER AdminAuthGuard (see AppModule) so `req.session` is available.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (CSRF_EXEMPT_PATHS.some((path) => req.path === path || req.path.startsWith(`${path}/`))) {
      return true;
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const headerRaw = req.headers['x-csrf-token'];
    const headerToken = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;

    if (!cookieToken || !headerToken || !timingSafeEqualString(cookieToken, headerToken)) {
      throw new HttpException(apiError(403, ERROR_CODES.CSRF_INVALID), 403);
    }
    req.csrfToken = cookieToken;

    if (req.session) {
      const stored = req.session.csrfTokenHash;
      if (!stored || stored !== sha256Hex(cookieToken)) {
        throw new HttpException(apiError(403, ERROR_CODES.CSRF_INVALID), 403);
      }
    }
    return true;
  }
}

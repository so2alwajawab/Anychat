import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger as NestLogger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ERROR_CODES, SESSION_COOKIE, apiError, timingSafeEqualString } from '@anychat/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { sha256Hex } from '../crypto/hash.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { RedisService } from '../redis/redis.module.js';
import { clientIp, ipPrefixOf, uaHashOf } from '../http-utils.js';
import { SESSION_IDLE_SECONDS, SESSION_SLIDING_WRITE_THRESHOLD_MS } from '../config/env.js';
import { AuditService } from '../../modules/audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../modules/audit/audit.constants.js';

/**
 * Single-owner admin guard: every route requires a live session cookie unless
 * explicitly marked `@Public()`. Sliding idle expiry (7d) capped by absolute
 * expiry (30d); fingerprint (IP prefix + UA hash) mismatches are soft — they
 * write an audit/warn row but never lock the owner out (mobile networks).
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly logger = new NestLogger(AdminAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) {
      throw new HttpException(apiError(401, ERROR_CODES.UNAUTHORIZED), 401);
    }

    const tokenHash = sha256Hex(token);
    const session = await this.prisma.ownerSession.findUnique({
      where: { tokenHash },
      include: {
        owner: {
          include: {
            // Phase 1: a user belongs to exactly one organization (their own).
            // Team support (multiple memberships) will need an explicit
            // org-selection step; until then we take the first membership.
            memberships: { take: 1, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    const now = new Date();
    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.absoluteExpiresAt <= now
    ) {
      throw new HttpException(apiError(401, ERROR_CODES.SESSION_EXPIRED), 401);
    }

    const ip = clientIp(req);
    const uaHash = uaHashOf(req);
    const ipMismatch =
      session.ipPrefix !== null && session.userAgentHash !== null
        ? !timingSafeEqualString(session.ipPrefix, ipPrefixOf(ip) ?? '') ||
          !timingSafeEqualString(session.userAgentHash, uaHash ?? '')
        : false;
    if (ipMismatch) {
      this.logger.warn(`session fingerprint mismatch for session ${session.id}`);
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.SESSION_FINGERPRINT_MISMATCH,
          actorId: session.ownerId,
          entity: 'session',
          entityId: session.id,
          outcome: 'failure',
          meta: { expectedIpPrefix: session.ipPrefix, actualIpPrefix: ipPrefixOf(ip) },
        },
        req,
      );
    }

    const idleExpiresAt = new Date(now.getTime() + SESSION_IDLE_SECONDS * 1000);
    const nextExpiresAt =
      idleExpiresAt > session.absoluteExpiresAt ? session.absoluteExpiresAt : idleExpiresAt;
    if (nextExpiresAt.getTime() - session.expiresAt.getTime() > SESSION_SLIDING_WRITE_THRESHOLD_MS) {
      await this.prisma.ownerSession.update({
        where: { id: session.id },
        data: { expiresAt: nextExpiresAt, lastSeenAt: now, userAgentHash: uaHash },
      });
    }

    req.session = {
      id: session.id,
      ownerId: session.ownerId,
      username: session.owner.username,
      csrfTokenHash: session.csrfTokenHash,
      platformAdmin: session.owner.platformRole === 'admin',
      createdAt: session.createdAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    };

    // A signed-in user with no organization cannot reach tenant data. This only
    // happens for an account that was never onboarded; treat it as unauthorized
    // rather than leaking an unscoped view.
    const membership = session.owner.memberships[0];
    if (!membership) {
      throw new HttpException(apiError(403, ERROR_CODES.UNAUTHORIZED), 403);
    }
    req.organizationId = membership.organizationId;

    return true;
  }
}

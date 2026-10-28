import { HttpException, Injectable, Logger as NestLogger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import argon2 from 'argon2';
import {
  ERROR_CODES,
  SESSION_COOKIE,
  apiError,
  randomToken,
  validatePassword,
} from '@anychat/shared';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { RedisService } from '../../common/redis/redis.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { sha256Hex } from '../../common/crypto/hash.js';
import { clientIp } from '../../common/http-utils.js';
import {
  LOGIN_IP_MAX_PER_MINUTE,
  LOGIN_LOCK_MINUTES,
  LOGIN_MAX_FAILURES,
  RECOVERY_IP_MAX_PER_5_MINUTES,
} from '../../common/config/env.js';
import type { LoginDto, RecoveryDto, SignupDto } from './dto.js';
import type { CreatedSession } from './session.service.js';
import { SessionService } from './session.service.js';

const ARGON_OPTIONS: NonNullable<Parameters<typeof argon2.hash>[1]> = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

/** Valid argon2id hash used to burn CPU on unknown usernames (timing parity). */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,p=1,t=3$vpvWRzmXDP0DmkcDXfg3JQ$Nh6qRbYQZsLHdJxF5/yKF78QZAXWjoCAKVY9hI1Xmn8';

export interface SafeUser {
  id: string;
  username: string;
}

export interface LoginOutcome {
  user: SafeUser;
  session: CreatedSession;
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function formatRecoveryCode(randomHex: string): string {
  return (randomHex.length >= 32 ? randomHex.slice(0, 32) : randomHex.padEnd(32, '0'))
    .toUpperCase()
    .match(/.{4}/g)!
    .join('-');
}

@Injectable()
export class AuthService {
  private readonly logger = new NestLogger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * The organization a user belongs to (phase 1: exactly one), or null. Used to
   * attribute auth audits: login/logout/recovery are public routes with no ALS
   * tenant context, so their audit rows must be stamped explicitly or they fall
   * outside the tenant-scoped audit list.
   */
  private async orgOf(userId: string): Promise<string | null> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return membership?.organizationId ?? null;
  }

  async login(dto: LoginDto, req: Request): Promise<LoginOutcome> {
    const ip = clientIp(req);
    const attempts = await this.redis.incrementWithTtl(`rl:login:ip:${ip}`, 60).catch(() => 1);
    if (attempts > LOGIN_IP_MAX_PER_MINUTE) {
      await this.audit.record({ action: AUDIT_ACTIONS.LOGIN_RATE_LIMITED, outcome: 'failure' }, req);
      throw new HttpException(apiError(429, ERROR_CODES.RATE_LIMITED), 429);
    }

    const identifier = dto.username.trim();
    // Accept either an email or a username as the login identifier.
    const account = await this.prisma.ownerAccount.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
      include: { memberships: { take: 1, orderBy: { createdAt: 'asc' } } },
    });
    // Resolve the tenant up front so every auth audit below can be stamped.
    const organizationId = account?.memberships[0]?.organizationId ?? null;

    if (!account) {
      await argon2.verify(DUMMY_HASH, dto.password).catch(() => false);
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          outcome: 'failure',
          meta: { username: identifier, reason: 'unknown_user' },
        },
        req,
      );
      throw new HttpException(apiError(401, ERROR_CODES.INVALID_CREDENTIALS), 401);
    }

    const now = Date.now();
    if (account.lockedUntil && account.lockedUntil.getTime() > now) {
      const retryAfterSeconds = Math.ceil((account.lockedUntil.getTime() - now) / 1000);
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.LOGIN_LOCKED,
          actorId: account.id,
          organizationId,
          outcome: 'failure',
          meta: { reason: 'still_locked', retryAfterSeconds },
        },
        req,
      );
      throw new HttpException(
        {
          ...apiError(429, ERROR_CODES.ACCOUNT_LOCKED),
          details: { retryAfterSeconds },
        },
        429,
      );
    }

    const valid = await argon2.verify(account.passwordHash, dto.password).catch(() => false);
    if (!valid) {
      const failedLoginCount = account.failedLoginCount + 1;
      const willLock = failedLoginCount >= LOGIN_MAX_FAILURES;
      const lockedUntil = willLock ? new Date(now + LOGIN_LOCK_MINUTES * 60_000) : null;
      await this.prisma.ownerAccount.update({
        where: { id: account.id },
        data: { failedLoginCount, lockedUntil },
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          actorId: account.id,
          organizationId,
          outcome: 'failure',
          meta: { failedLoginCount, reason: 'bad_password' },
        },
        req,
      );
      if (willLock) {
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.LOGIN_LOCKED,
            actorId: account.id,
            organizationId,
            outcome: 'failure',
            meta: { lockedUntil: lockedUntil?.toISOString() },
          },
          req,
        );
        throw new HttpException(
          {
            ...apiError(429, ERROR_CODES.ACCOUNT_LOCKED),
            details: { retryAfterSeconds: LOGIN_LOCK_MINUTES * 60 },
          },
          429,
        );
      }
      throw new HttpException(apiError(401, ERROR_CODES.INVALID_CREDENTIALS), 401);
    }

    if (account.failedLoginCount > 0 || account.lockedUntil !== null) {
      await this.prisma.ownerAccount.update({
        where: { id: account.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }

    const csrfToken = req.csrfToken ?? randomToken(32);
    const session = await this.sessions.create(account.id, csrfToken, req);
    await this.audit.record(
      { action: AUDIT_ACTIONS.LOGIN_SUCCESS, actorId: account.id, organizationId },
      req,
    );

    return { user: { id: account.id, username: account.username }, session };
  }

  /**
   * Registers a new customer: creates the user account, their first
   * organization (workspace), and an `owner` membership linking them — all in a
   * single transaction so a partial signup can never leave an orphaned account.
   * Ends by opening a session, exactly like login.
   */
  async signup(dto: SignupDto, req: Request): Promise<LoginOutcome> {
    const ip = clientIp(req);
    const attempts = await this.redis.incrementWithTtl(`rl:signup:ip:${ip}`, 60).catch(() => 1);
    if (attempts > LOGIN_IP_MAX_PER_MINUTE) {
      await this.audit.record(
        { action: AUDIT_ACTIONS.SIGNUP_RATE_LIMITED, outcome: 'failure' },
        req,
      );
      throw new HttpException(apiError(429, ERROR_CODES.RATE_LIMITED), 429);
    }

    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();
    const orgName = (dto.organizationName ?? '').trim() || `${username}'s Workspace`;

    // Password policy mirrors recovery: length + weak/common + no username leak.
    const policy = validatePassword(dto.password, username);
    if (!policy.ok) {
      throw new HttpException(
        apiError(422, ERROR_CODES.PASSWORD_TOO_WEAK, { reason: policy.reason }),
        422,
      );
    }

    // Pre-check for a clear conflict message (the unique constraints are still
    // the source of truth under a race; see catch below).
    const taken = await this.prisma.ownerAccount.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (taken) {
      const code = taken.email === email ? ERROR_CODES.EMAIL_TAKEN : ERROR_CODES.USERNAME_TAKEN;
      await this.audit.record(
        { action: AUDIT_ACTIONS.SIGNUP_FAILED, outcome: 'failure', meta: { reason: code } },
        req,
      );
      throw new HttpException(apiError(409, code), 409);
    }

    const passwordHash = await argon2.hash(dto.password, ARGON_OPTIONS);
    const csrfToken = req.csrfToken ?? randomToken(32);

    let accountId: string;
    let organizationId: string;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const account = await tx.ownerAccount.create({
          data: { username, email, passwordHash },
        });
        const organization = await tx.organization.create({
          data: { name: orgName },
        });
        await tx.membership.create({
          data: { userId: account.id, organizationId: organization.id, role: 'owner' },
        });
        return { accountId: account.id, organizationId: organization.id };
      });
      accountId = created.accountId;
      organizationId = created.organizationId;
    } catch (err) {
      // Unique-constraint race: someone registered the same email/username
      // between our pre-check and the insert.
      const message = err instanceof Error ? err.message : '';
      if (message.includes('owner_account_email_key')) {
        throw new HttpException(apiError(409, ERROR_CODES.EMAIL_TAKEN), 409);
      }
      if (message.includes('owner_account_username_key')) {
        throw new HttpException(apiError(409, ERROR_CODES.USERNAME_TAKEN), 409);
      }
      throw err;
    }

    const session = await this.sessions.create(accountId, csrfToken, req);
    await this.audit.record(
      {
        action: AUDIT_ACTIONS.SIGNUP_SUCCESS,
        actorId: accountId,
        entity: 'organization',
        entityId: organizationId,
        meta: { username, organizationName: orgName },
      },
      req,
    );

    return { user: { id: accountId, username }, session };
  }

  async logout(req: Request): Promise<{ ok: true }> {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) {
      const session = await this.prisma.ownerSession.findUnique({
        where: { tokenHash: sha256Hex(token) },
      });
      if (session && !session.revokedAt) {
        await this.sessions.revokeByToken(token);
        const organizationId = await this.orgOf(session.ownerId);
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.LOGOUT,
            actorId: session.ownerId,
            organizationId,
            entity: 'session',
            entityId: session.id,
          },
          req,
        );
      }
    }
    return { ok: true };
  }

  async recover(dto: RecoveryDto, req: Request): Promise<LoginOutcome & { recoveryCode: string }> {
    const ip = clientIp(req);
    const attempts = await this.redis.incrementWithTtl(`rl:recovery:ip:${ip}`, 300).catch(() => 1);
    if (attempts > RECOVERY_IP_MAX_PER_5_MINUTES) {
      await this.audit.record(
        { action: AUDIT_ACTIONS.RECOVERY_RATE_LIMITED, outcome: 'failure' },
        req,
      );
      throw new HttpException(apiError(429, ERROR_CODES.RATE_LIMITED), 429);
    }

    const normalized = normalizeRecoveryCode(dto.code);
    const record = await this.prisma.passwordRecovery.findUnique({
      where: { codeHash: sha256Hex(normalized) },
    });
    if (!record) {
      await this.audit.record(
        { action: AUDIT_ACTIONS.RECOVERY_USED, outcome: 'failure', meta: { reason: 'invalid_code' } },
        req,
      );
      throw new HttpException(apiError(401, ERROR_CODES.RECOVERY_CODE_INVALID), 401);
    }
    if (record.usedAt) {
      await this.audit.record(
        { action: AUDIT_ACTIONS.RECOVERY_USED, outcome: 'failure', meta: { reason: 'already_used' } },
        req,
      );
      throw new HttpException(apiError(400, ERROR_CODES.RECOVERY_CODE_USED), 400);
    }

    const account = await this.prisma.ownerAccount.findUnique({ where: { id: record.ownerId } });
    if (!account) {
      throw new HttpException(apiError(401, ERROR_CODES.RECOVERY_CODE_INVALID), 401);
    }

    const policy = validatePassword(dto.newPassword, account.username);
    if (!policy.ok) {
      throw new HttpException(
        apiError(422, ERROR_CODES.PASSWORD_TOO_WEAK, { reason: policy.reason }),
        422,
      );
    }

    const passwordHash = await argon2.hash(dto.newPassword, ARGON_OPTIONS);
    const newRecoveryCode = formatRecoveryCode(randomBytes(16).toString('hex'));

    await this.prisma.$transaction([
      this.prisma.ownerAccount.update({
        where: { id: account.id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordRecovery.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordRecovery.create({
        data: { ownerId: account.id, codeHash: sha256Hex(normalizeRecoveryCode(newRecoveryCode)) },
      }),
      this.prisma.ownerSession.updateMany({
        where: { ownerId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.record(
      {
        action: AUDIT_ACTIONS.RECOVERY_USED,
        actorId: account.id,
        organizationId: await this.orgOf(account.id),
        entity: 'owner_account',
        entityId: account.id,
        meta: { sessionsRevoked: true, codeRotated: true },
      },
      req,
    );

    const csrfToken = req.csrfToken ?? randomToken(32);
    const session = await this.sessions.create(account.id, csrfToken, req);

    return {
      user: { id: account.id, username: account.username },
      session,
      recoveryCode: newRecoveryCode,
    };
  }
}

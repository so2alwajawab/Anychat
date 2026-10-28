import { Injectable, Logger as NestLogger, OnModuleInit } from '@nestjs/common';
import { serverEnv } from '../../common/config/env.js';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';

/**
 * Phase 3 bootstrap: promotes accounts listed in PLATFORM_ADMIN_USERNAMES to
 * `platformRole: 'admin'` on API boot. Idempotent — accounts already marked
 * admin are skipped, and the promotion is audited (actor: system). Nobody is
 * ever demoted here; removal from the allowlist does not revoke access (flip
 * the column manually if you must revoke).
 */
@Injectable()
export class AdminBootstrap implements OnModuleInit {
  private readonly logger = new NestLogger(AdminBootstrap.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    const names = (serverEnv.PLATFORM_ADMIN_USERNAMES ?? '')
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;

    try {
      const accounts = await this.prisma.ownerAccount.findMany({
        where: { username: { in: names, mode: 'insensitive' } },
        select: { id: true, username: true, platformRole: true },
      });

      const missing = names.filter(
        (n) => !accounts.some((a) => a.username.toLowerCase() === n.toLowerCase()),
      );
      if (missing.length > 0) {
        this.logger.warn(
          `PLATFORM_ADMIN_USERNAMES: no account found for ${missing.join(', ')}`,
        );
      }

      for (const account of accounts) {
        if (account.platformRole === 'admin') continue;
        await this.prisma.ownerAccount.update({
          where: { id: account.id },
          data: { platformRole: 'admin' },
        });
        await this.audit.record({
          action: AUDIT_ACTIONS.PLATFORM_ADMIN_PROMOTED,
          actorType: 'system',
          actorId: account.id,
          entity: 'owner_account',
          entityId: account.id,
          meta: { username: account.username, source: 'PLATFORM_ADMIN_USERNAMES' },
        });
        this.logger.log(`promoted ${account.username} to platform admin`);
      }
    } catch (err) {
      // Boot must not die on a transient DB error; the allowlist is retried
      // on the next restart.
      this.logger.error(
        `platform-admin bootstrap failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }
}

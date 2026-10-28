import { Injectable, Logger as NestLogger } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import type { Request } from 'express';
import { redactValue } from '@anychat/shared';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { clientIp, userAgentOf } from '../../common/http-utils.js';
import type { AuditEntry } from './audit.constants.js';

@Injectable()
export class AuditService {
  private readonly fallbackLogger = new NestLogger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  async record(entry: AuditEntry, req?: Request): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorId: entry.actorId ?? null,
          actorType: entry.actorType ?? 'owner',
          entity: entry.entity ?? null,
          entityId: entry.entityId ?? null,
          outcome: entry.outcome ?? 'success',
          ip: req ? clientIp(req) : (entry.ip ?? null),
          userAgent: req ? userAgentOf(req) : (entry.userAgent ?? null),
          meta: entry.meta ? (redactValue(entry.meta) as object) : undefined,
          // Request-path records are auto-stamped by the tenancy extension from
          // the ALS context; background paths pass the tenant explicitly. If both
          // are present the extension's context value wins (it overwrites), which
          // is the safe direction.
          organizationId: entry.organizationId ?? null,
        },
      });
    } catch (err) {
      this.fallbackLogger.error(`audit write failed for ${entry.action}: ${(err as Error).message}`);
      this.logger.error({ action: entry.action }, 'audit write failed');
    }
  }
}

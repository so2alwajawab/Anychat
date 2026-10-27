import { Controller, Get, HttpException, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ERROR_CODES, apiError } from '@anychat/shared';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { AuditService } from './audit.service.js';
import { AUDIT_ACTIONS } from './audit.constants.js';

class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

@Controller('audit')
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query() query: AuditQueryDto) {
    try {
      const rows = await this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 50,
        select: {
          id: true,
          createdAt: true,
          actorId: true,
          actorType: true,
          action: true,
          entity: true,
          entityId: true,
          outcome: true,
          ip: true,
          userAgent: true,
          meta: true,
        },
      });
      return { items: rows };
    } catch (err) {
      await this.audit.record({
        action: AUDIT_ACTIONS.AUDIT_QUERY_FAILED,
        outcome: 'failure',
        meta: { error: (err as Error).message },
      });
      throw new HttpException(apiError(500, ERROR_CODES.INTERNAL_ERROR), 500);
    }
  }
}

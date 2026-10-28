import {
  Controller,
  Get,
  HttpException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ERROR_CODES, apiError } from '@anychat/shared';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard.js';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { ListRunsQueryDto } from './dto.js';
import { ExecutionQueueService } from './execution-queue.service.js';

@Controller('runs')
@UseGuards(AdminAuthGuard)
export class RunsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: ExecutionQueueService,
  ) {}

  @Get()
  async listRuns(@Query() query: ListRunsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.workflowId) {
      where.workflowVersion = { workflowId: query.workflowId };
    }
    if (query.platform) {
      where.commentEvent = { platform: query.platform };
    }

    const [items, total] = await Promise.all([
      this.prisma.executionRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          workflowVersion: {
            include: {
              workflow: {
                select: { id: true, name: true, status: true },
              },
            },
          },
          commentEvent: {
            select: {
              id: true,
              platform: true,
              externalCommentId: true,
              authorUsername: true,
              text: true,
              sourceCreatedAt: true,
            },
          },
          outboundActions: {
            select: {
              id: true,
              actionType: true,
              status: true,
              remoteMessageId: true,
              sentAt: true,
              lastErrorCode: true,
            },
          },
          _count: {
            select: { nodeExecutions: true },
          },
        },
      }),
      this.prisma.executionRun.count({ where }),
    ]);

    return {
      items: items.map((run) => ({
        id: run.id,
        status: run.status,
        skipReason: run.skipReason,
        workflowId: run.workflowVersion.workflow.id,
        workflowName: run.workflowVersion.workflow.name,
        workflowVersion: run.workflowVersion.version,
        comment: run.commentEvent,
        outboundActions: run.outboundActions,
        stepsCount: run._count.nodeExecutions,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get(':id')
  async getRunById(@Param('id', ParseUUIDPipe) id: string) {
    const run = await this.prisma.executionRun.findUnique({
      where: { id },
      include: {
        workflowVersion: {
          include: {
            workflow: {
              select: { id: true, name: true, status: true },
            },
          },
        },
        commentEvent: {
          include: {
            asset: { select: { id: true, displayName: true, platform: true } },
            post: { select: { id: true, externalId: true, messagePreview: true } },
          },
        },
        nodeExecutions: {
          orderBy: { startedAt: 'asc' },
        },
        outboundActions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!run) {
      throw new HttpException(apiError(404, ERROR_CODES.RUN_NOT_FOUND), 404);
    }

    return {
      id: run.id,
      status: run.status,
      skipReason: run.skipReason,
      workflowId: run.workflowVersion.workflow.id,
      workflowName: run.workflowVersion.workflow.name,
      workflowVersion: run.workflowVersion.version,
      comment: run.commentEvent,
      steps: run.nodeExecutions,
      outboundActions: run.outboundActions,
      contextSnapshot: run.contextSnapshot,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    };
  }

  @Post(':id/retry')
  async retryRun(@Param('id', ParseUUIDPipe) id: string) {
    const run = await this.prisma.executionRun.findUnique({ where: { id } });
    if (!run) {
      throw new HttpException(apiError(404, ERROR_CODES.RUN_NOT_FOUND), 404);
    }

    if (run.status !== 'failed') {
      throw new HttpException(apiError(400, ERROR_CODES.RUN_NOT_RETRYABLE), 400);
    }

    await this.prisma.executionRun.update({
      where: { id },
      data: {
        status: 'pending',
        attempt: { increment: 1 },
      },
    });

    await this.queue.enqueueExecution(id);

    return { success: true, message: 'تمت إعادة جدولة عملية التنفيذ بنجاح' };
  }
}

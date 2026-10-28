import { Injectable, Logger } from '@nestjs/common';
import type { WorkflowDefinition } from '@anychat/shared';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Matches an incoming CommentEvent against active published workflows.
   * Creates ExecutionRun records idempotently.
   */
  async matchCommentEvent(commentEventId: string): Promise<string[]> {
    const comment = await this.prisma.commentEvent.findUnique({
      where: { id: commentEventId },
      include: { asset: true, post: true },
    });

    if (!comment) {
      this.logger.warn(`CommentEvent ${commentEventId} not found`);
      return [];
    }

    // 1. Find candidate workflows (published or paused)
    const workflows = await this.prisma.workflow.findMany({
      where: {
        status: { in: ['published', 'paused'] },
        OR: [{ assetId: null }, { assetId: comment.assetId }],
      },
      include: {
        versions: {
          where: { state: 'published' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    const runIds: string[] = [];

    for (const wf of workflows) {
      const activeVersion = wf.versions[0];
      if (!activeVersion) continue;

      const def = activeVersion.definition as unknown as WorkflowDefinition;
      const nodes = Array.isArray(def?.nodes) ? def.nodes : [];
      const trigger = nodes.find((n) => n.type === 'trigger.comment');
      if (!trigger) continue;

      const triggerData = (trigger.data ?? {}) as {
        platform?: string;
        assetIds?: string[];
        includeReplies?: boolean;
        postScope?: { mode?: string; postExternalIds?: string[] };
      };

      // Filter by platform
      if (triggerData.platform && triggerData.platform !== 'all' && triggerData.platform !== comment.platform) {
        continue;
      }

      // Filter by assetIds
      if (triggerData.assetIds && triggerData.assetIds.length > 0 && !triggerData.assetIds.includes(comment.assetId)) {
        continue;
      }

      // Filter by top-level replies
      if (triggerData.includeReplies === false && comment.parentCommentId) {
        continue;
      }

      // Filter by postScope
      if (triggerData.postScope?.mode === 'posts' && triggerData.postScope.postExternalIds?.length) {
        if (!comment.post || !triggerData.postScope.postExternalIds.includes(comment.post.externalId)) {
          continue;
        }
      }

      // Dedupe check: has this comment already triggered this workflow version?
      const existingRun = await this.prisma.executionRun.findUnique({
        where: {
          workflowVersionId_commentEventId: {
            workflowVersionId: activeVersion.id,
            commentEventId: comment.id,
          },
        },
      });

      if (existingRun) {
        this.logger.debug(`ExecutionRun already exists for workflow ${wf.id} and comment ${comment.id}`);
        continue;
      }

      // Handle Paused Workflow: records skipped run
      if (wf.status === 'paused') {
        const skippedRun = await this.prisma.executionRun.create({
          data: {
            organizationId: comment.organizationId,
            workflowVersionId: activeVersion.id,
            commentEventId: comment.id,
            status: 'skipped',
            skipReason: 'workflow_paused',
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        });

        await this.audit.record({
          action: AUDIT_ACTIONS.EXECUTION_RUN_SKIPPED,
          entity: 'execution_run',
          entityId: skippedRun.id,
          meta: { workflowId: wf.id, name: wf.name, reason: 'workflow_paused' },
        });

        continue;
      }

      // Create new active ExecutionRun
      const newRun = await this.prisma.executionRun.create({
        data: {
          organizationId: comment.organizationId,
          workflowVersionId: activeVersion.id,
          commentEventId: comment.id,
          status: 'pending',
          contextSnapshot: {
            workflowId: wf.id,
            workflowName: wf.name,
            version: activeVersion.version,
            commentText: comment.text,
            platform: comment.platform,
            authorUsername: comment.authorUsername,
          },
        },
      });

      await this.audit.record({
        action: AUDIT_ACTIONS.EXECUTION_RUN_STARTED,
        entity: 'execution_run',
        entityId: newRun.id,
        meta: { workflowId: wf.id, name: wf.name, version: activeVersion.version },
      });

      runIds.push(newRun.id);
    }

    return runIds;
  }
}

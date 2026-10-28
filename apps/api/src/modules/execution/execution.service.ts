import { Injectable, Logger } from '@nestjs/common';
import type { WorkflowDefinition, WorkflowNode, WorkflowEdge } from '@anychat/shared';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { OutboundService } from './outbound.service.js';

export function renderVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    return vars[key] ?? `{{${key}}}`;
  });
}

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: OutboundService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Executes a workflow run through its node graph.
   */
  async executeRun(runId: string): Promise<void> {
    const run = await this.prisma.executionRun.findUnique({
      where: { id: runId },
      include: {
        workflowVersion: {
          include: { workflow: true },
        },
        commentEvent: {
          include: { asset: true, post: true },
        },
      },
    });

    if (!run) {
      this.logger.warn(`ExecutionRun ${runId} not found`);
      return;
    }

    if (run.status === 'succeeded' || run.status === 'skipped') {
      return;
    }

    await this.prisma.executionRun.update({
      where: { id: runId },
      data: { status: 'running' },
    });

    const comment = run.commentEvent;
    const wf = run.workflowVersion.workflow;
    const def = run.workflowVersion.definition as unknown as WorkflowDefinition;
    const nodes: WorkflowNode[] = Array.isArray(def?.nodes) ? def.nodes : [];
    const edges: WorkflowEdge[] = Array.isArray(def?.edges) ? def.edges : [];

    const trigger = nodes.find((n) => n.type === 'trigger.comment');
    if (!trigger) {
      await this.prisma.executionRun.update({
        where: { id: runId },
        data: { status: 'failed', skipReason: 'missing_trigger', finishedAt: new Date() },
      });
      return;
    }

    // Record trigger execution
    await this.prisma.nodeExecution.create({
      data: {
        runId,
        nodeId: trigger.id,
        nodeType: trigger.type,
        status: 'executed',
        inputSummary: { commentId: comment.externalCommentId, text: comment.text },
        outputSummary: { platform: comment.platform, author: comment.authorUsername },
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    // Variable context for template substitution (both object notation and aliases)
    const variableContext: Record<string, string> = {
      commenter_name: comment.authorUsername || 'عزيزي المتابع',
      comment_text: comment.text || '',
      page_name: comment.asset.displayName || 'الصفحة',
      current_date: new Date().toLocaleDateString('ar-EG'),
      'comment.id': comment.externalCommentId,
      'comment.text': comment.text || '',
      'comment.created_time': comment.sourceCreatedAt ? new Date(comment.sourceCreatedAt).toISOString() : '',
      'post.id': comment.post?.externalId || '',
      'post.permalink': comment.post?.permalink || '',
      'asset.name': comment.asset.displayName || '',
      'workflow.name': wf.name,
      'now.date': new Date().toLocaleDateString('ar-EG'),
    };

    let currentId = trigger.id;
    let chosenHandle: string | null = null;
    let keepGoing = true;
    let runFailed = false;
    let stepCount = 0;
    const maxSteps = 50;

    while (keepGoing && stepCount++ < maxSteps) {
      const outEdges = edges.filter((e) => e.source === currentId);
      if (outEdges.length === 0) break;

      let nextEdge: WorkflowEdge | undefined;
      if (chosenHandle) {
        nextEdge =
          outEdges.find((e) => e.sourceHandle === chosenHandle) ??
          (chosenHandle === 'true' ? outEdges.find((e) => !e.sourceHandle) : undefined);
      } else {
        nextEdge = outEdges[0];
      }

      if (!nextEdge) break;

      const nextNode = nodes.find((n) => n.id === nextEdge.target);
      if (!nextNode) break;

      currentId = nextNode.id;
      chosenHandle = null;

      const stepStart = new Date();

      if (nextNode.type === 'condition.text') {
        const data = (nextNode.data ?? {}) as {
          op?: 'AND' | 'OR';
          rules?: Array<{ kind: string; value: string; caseSensitive?: boolean }>;
        };
        const rules = data.rules ?? [];
        const op = data.op ?? 'OR';
        const text = comment.text || '';

        const matches = rules.map((r) => {
          const val = r.caseSensitive ? r.value : r.value.toLowerCase();
          const target = r.caseSensitive ? text : text.toLowerCase();
          if (r.kind === 'text_contains') return target.includes(val);
          if (r.kind === 'text_exact') return target.trim() === val.trim();
          if (r.kind === 'text_excludes') return !target.includes(val);
          return target.includes(val);
        });

        const conditionMet = op === 'AND' ? matches.every(Boolean) : matches.some(Boolean);

        await this.prisma.nodeExecution.create({
          data: {
            runId,
            nodeId: nextNode.id,
            nodeType: nextNode.type,
            status: conditionMet ? 'passed' : 'failed',
            inputSummary: { rules, op, evaluatedText: text },
            outputSummary: { conditionMet },
            startedAt: stepStart,
            finishedAt: new Date(),
          },
        });

        chosenHandle = conditionMet ? 'true' : 'false';
      } else if (nextNode.type === 'condition.asset_post') {
        const data = (nextNode.data ?? {}) as { assetIds?: string[]; postIds?: string[] };
        const assetMatch = !data.assetIds?.length || data.assetIds.includes(comment.assetId);
        const postMatch = !data.postIds?.length || (comment.post && data.postIds.includes(comment.post.externalId));
        const conditionMet = Boolean(assetMatch && postMatch);

        await this.prisma.nodeExecution.create({
          data: {
            runId,
            nodeId: nextNode.id,
            nodeType: nextNode.type,
            status: conditionMet ? 'passed' : 'failed',
            inputSummary: data,
            outputSummary: { conditionMet },
            startedAt: stepStart,
            finishedAt: new Date(),
          },
        });

        chosenHandle = conditionMet ? 'true' : 'false';
      } else if (nextNode.type === 'action.public_reply' || nextNode.type === 'action.use_template') {
        let rawMessage = '';
        if (nextNode.type === 'action.use_template') {
          const tplData = (nextNode.data ?? {}) as { templateId?: string };
          if (tplData.templateId) {
            const tmpl = await this.prisma.messageTemplate.findUnique({
              where: { id: tplData.templateId },
            });
            rawMessage = tmpl?.body || '';
          }
        } else {
          rawMessage = ((nextNode.data ?? {}) as { message?: string }).message || '';
        }

        const rendered = renderVariables(rawMessage, variableContext);

        // Pre-flight eligibility check
        if (comment.post && comment.post.isEligibleForReply === false) {
          await this.prisma.nodeExecution.create({
            data: {
              runId,
              nodeId: nextNode.id,
              nodeType: nextNode.type,
              status: 'skipped',
              errorCode: 'CAN_COMMENT_FALSE',
              errorMessage: 'المنشور غير متاح للتعليق عليه (can_comment=false)',
              inputSummary: { targetCommentId: comment.externalCommentId },
              startedAt: stepStart,
              finishedAt: new Date(),
            },
          });
          keepGoing = false;
          break;
        }

        const outboundResult = await this.outbound.executePublicReply({
          runId,
          assetId: comment.assetId,
          platform: comment.platform as 'facebook' | 'instagram',
          targetCommentId: comment.externalCommentId,
          renderedMessage: rendered,
        });

        await this.prisma.nodeExecution.create({
          data: {
            runId,
            nodeId: nextNode.id,
            nodeType: nextNode.type,
            status: outboundResult.ok ? 'executed' : outboundResult.status,
            inputSummary: { renderedMessage: rendered, targetCommentId: comment.externalCommentId },
            outputSummary: {
              actionId: outboundResult.actionId,
              remoteMessageId: outboundResult.remoteMessageId,
              status: outboundResult.status,
            },
            errorCode: outboundResult.errorCode,
            errorMessage: outboundResult.errorMessage,
            startedAt: stepStart,
            finishedAt: new Date(),
          },
        });

        if (!outboundResult.ok && outboundResult.status === 'failed') {
          runFailed = true;
          keepGoing = false;
          break;
        }
      } else if (nextNode.type === 'action.private_reply') {
        let rawMessage = '';
        const nodeData = (nextNode.data ?? {}) as { message?: string; templateId?: string };
        if (nodeData.templateId) {
          const tmpl = await this.prisma.messageTemplate.findUnique({
            where: { id: nodeData.templateId },
          });
          rawMessage = tmpl?.body || '';
        } else {
          rawMessage = nodeData.message || '';
        }

        const rendered = renderVariables(rawMessage, variableContext);

        const outboundResult = await this.outbound.executePrivateReply({
          runId,
          assetId: comment.assetId,
          platform: comment.platform as 'facebook' | 'instagram',
          targetCommentId: comment.externalCommentId,
          sourceCreatedAt: comment.sourceCreatedAt,
          renderedMessage: rendered,
        });

        await this.prisma.nodeExecution.create({
          data: {
            runId,
            nodeId: nextNode.id,
            nodeType: nextNode.type,
            status: outboundResult.ok ? 'executed' : outboundResult.status,
            inputSummary: { renderedMessage: rendered, targetCommentId: comment.externalCommentId },
            outputSummary: {
              actionId: outboundResult.actionId,
              remoteMessageId: outboundResult.remoteMessageId,
              status: outboundResult.status,
            },
            errorCode: outboundResult.errorCode,
            errorMessage: outboundResult.errorMessage,
            startedAt: stepStart,
            finishedAt: new Date(),
          },
        });

        if (!outboundResult.ok && outboundResult.status === 'failed') {
          runFailed = true;
          keepGoing = false;
          break;
        }
      } else if (nextNode.type === 'action.stop') {
        await this.prisma.nodeExecution.create({
          data: {
            runId,
            nodeId: nextNode.id,
            nodeType: nextNode.type,
            status: 'executed',
            inputSummary: nextNode.data as object,
            outputSummary: { stopped: true },
            startedAt: stepStart,
            finishedAt: new Date(),
          },
        });
        keepGoing = false;
        break;
      }
    }

    const finalStatus = runFailed ? 'failed' : 'succeeded';
    await this.prisma.executionRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
      },
    });

    await this.audit.record({
      action: finalStatus === 'succeeded' ? AUDIT_ACTIONS.EXECUTION_RUN_COMPLETED : AUDIT_ACTIONS.EXECUTION_RUN_FAILED,
      entity: 'execution_run',
      entityId: runId,
      meta: {
        workflowId: wf.id,
        workflowName: wf.name,
        commentId: comment.externalCommentId,
        platform: comment.platform,
      },
    });
  }
}

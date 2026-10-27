import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ERROR_CODES,
  apiError,
  validateWorkflowDefinition,
  type WorkflowDefinition,
} from '@anychat/shared';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import type {
  CreateWorkflowDto,
  PublishWorkflowDto,
  TestRunDto,
  UpdateWorkflowDraftDto,
} from './dto.js';

export function createDefaultDefinition(_name = 'مخطط أتمتة جديد'): WorkflowDefinition {
  return {
    schemaVersion: 1,
    nodes: [
      {
        id: 'node-trigger',
        type: 'trigger.comment',
        position: { x: 250, y: 50 },
        data: {
          platform: 'all',
          assetIds: [],
          postScope: { mode: 'all', postExternalIds: [] },
          includeReplies: false,
        },
      },
      {
        id: 'node-condition',
        type: 'condition.text',
        position: { x: 250, y: 180 },
        data: {
          op: 'OR',
          rules: [{ kind: 'text_contains', value: 'سعر', caseSensitive: false }],
        },
      },
      {
        id: 'node-public-reply',
        type: 'action.public_reply',
        position: { x: 120, y: 320 },
        data: {
          message: 'أهلاً بك، تم الرد على استفسارك بنجاح.',
        },
      },
      {
        id: 'node-stop',
        type: 'action.stop',
        position: { x: 120, y: 450 },
        data: {
          reason: 'اكتمال الرد',
        },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'node-trigger', target: 'node-condition' },
      { id: 'edge-2', source: 'node-condition', target: 'node-public-reply', sourceHandle: 'true' },
      { id: 'edge-3', source: 'node-public-reply', target: 'node-stop' },
    ],
    settings: {
      stopOnError: true,
      privateReplyWindowMinutes: 10080,
      dedupeTtlHours: 168,
    },
  };
}

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const items = await this.prisma.workflow.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        asset: {
          select: { id: true, displayName: true, platform: true },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 2,
        },
      },
    });

    return items.map((wf) => {
      const activeVersion = wf.versions.find((v) => v.state === 'published');
      const draftVersion = wf.versions.find((v) => v.state === 'draft');
      return {
        id: wf.id,
        name: wf.name,
        description: wf.description,
        status: wf.status,
        currentVersion: wf.currentVersion,
        lockVersion: wf.lockVersion,
        assetId: wf.assetId,
        asset: wf.asset,
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
        hasDraft: Boolean(draftVersion),
        hasPublished: Boolean(activeVersion),
        activeVersionNumber: activeVersion?.version ?? null,
      };
    });
  }

  async getById(id: string) {
    const wf = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        asset: {
          select: { id: true, displayName: true, platform: true },
        },
        versions: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!wf) {
      throw new NotFoundException('مخطط الأتمتة غير موجود');
    }

    const draftVersion = wf.versions.find((v) => v.state === 'draft');
    const publishedVersion = wf.versions.find((v) => v.state === 'published');

    return {
      id: wf.id,
      name: wf.name,
      description: wf.description,
      status: wf.status,
      currentVersion: wf.currentVersion,
      lockVersion: wf.lockVersion,
      assetId: wf.assetId,
      asset: wf.asset,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt,
      draftDefinition: draftVersion ? (draftVersion.definition as object) : null,
      publishedDefinition: publishedVersion ? (publishedVersion.definition as object) : null,
      versions: wf.versions.map((v) => ({
        id: v.id,
        version: v.version,
        state: v.state,
        publishedNote: v.publishedNote,
        publishedAt: v.publishedAt,
        createdAt: v.createdAt,
      })),
    };
  }

  async create(dto: CreateWorkflowDto, actorId?: string) {
    const definition = (dto.definition as WorkflowDefinition) ?? createDefaultDefinition(dto.name);

    const workflow = await this.prisma.workflow.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        assetId: dto.assetId || null,
        status: 'draft',
        currentVersion: 0,
        lockVersion: 1,
        versions: {
          create: {
            version: 0,
            definition: definition as object,
            state: 'draft',
          },
        },
      },
      include: {
        versions: true,
      },
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.WORKFLOW_CREATED,
      actorId,
      entity: 'workflow',
      entityId: workflow.id,
      meta: { name: workflow.name },
    });

    return workflow;
  }

  async updateDraft(id: string, dto: UpdateWorkflowDraftDto, actorId?: string) {
    const wf = await this.prisma.workflow.findUnique({
      where: { id },
      include: { versions: true },
    });

    if (!wf) {
      throw new NotFoundException('مخطط الأتمتة غير موجود');
    }

    // Optimistic Concurrency Check (Gate G4)
    if (wf.lockVersion !== dto.lockVersion) {
      throw new HttpException(
        apiError(409, ERROR_CODES.CONFLICT, {
          serverLockVersion: wf.lockVersion,
          serverSnapshot: wf,
        }),
        409,
      );
    }

    const draft = wf.versions.find((v) => v.state === 'draft');

    if (draft) {
      await this.prisma.workflowVersion.update({
        where: { id: draft.id },
        data: { definition: dto.definition as object, version: 0 },
      });
    } else {
      await this.prisma.workflowVersion.create({
        data: {
          workflowId: id,
          version: 0,
          definition: dto.definition as object,
          state: 'draft',
        },
      });
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : wf.name,
        description: dto.description !== undefined ? dto.description?.trim() : wf.description,
        assetId: dto.assetId !== undefined ? dto.assetId : wf.assetId,
        lockVersion: wf.lockVersion + 1,
      },
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.WORKFLOW_UPDATED,
      actorId,
      entity: 'workflow',
      entityId: id,
      meta: { name: updated.name, lockVersion: updated.lockVersion },
    });

    return updated;
  }

  async publish(id: string, dto: PublishWorkflowDto = {}, actorId?: string) {
    const wf = await this.prisma.workflow.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' } } },
    });

    if (!wf) {
      throw new NotFoundException('مخطط الأتمتة غير موجود');
    }

    let draftDef: WorkflowDefinition | null = (dto.definition as WorkflowDefinition) ?? null;
    if (!draftDef) {
      const draft = wf.versions.find((v) => v.state === 'draft');
      if (draft) {
        draftDef = draft.definition as unknown as WorkflowDefinition;
      }
    }

    if (!draftDef) {
      throw new BadRequestException('لا توجد مسودة جديدة قابلة للنشر');
    }

    // Gather connected asset IDs and template IDs for validation context
    const assets = await this.prisma.metaConnectedAsset.findMany({ select: { id: true } });
    const templates = await this.prisma.messageTemplate.findMany({ select: { id: true } });

    const availableAssetIds = assets.map((a) => a.id);
    const availableTemplateIds = templates.map((t) => t.id);

    // Validate strictly before publishing
    const validation = validateWorkflowDefinition(draftDef, {
      availableAssetIds,
      availableTemplateIds,
    });

    if (!validation.valid) {
      throw new HttpException(
        apiError(400, ERROR_CODES.VALIDATION_ERROR, { errors: validation.errors }),
        400,
      );
    }

    const nextVersion = wf.currentVersion + 1;

    // Archive previous published versions
    await this.prisma.workflowVersion.updateMany({
      where: { workflowId: id, state: 'published' },
      data: { state: 'archived' },
    });

    // Clean up any old draft records to avoid unique constraint collision
    await this.prisma.workflowVersion.deleteMany({
      where: { workflowId: id, state: 'draft' },
    });

    // Freeze draft into an immutable published version
    const publishedVersion = await this.prisma.workflowVersion.create({
      data: {
        workflowId: id,
        version: nextVersion,
        definition: draftDef as object,
        state: 'published',
        publishedNote: dto.publishedNote?.trim(),
        publishedAt: new Date(),
      },
    });

    // Recreate a clean working draft copy with version: 0 for ongoing edits
    await this.prisma.workflowVersion.create({
      data: {
        workflowId: id,
        version: 0,
        definition: draftDef as object,
        state: 'draft',
      },
    });

    const updatedWf = await this.prisma.workflow.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : wf.name,
        description: dto.description !== undefined ? dto.description?.trim() : wf.description,
        status: 'published',
        currentVersion: nextVersion,
        lockVersion: wf.lockVersion + 1,
      },
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.WORKFLOW_PUBLISHED,
      actorId,
      entity: 'workflow',
      entityId: id,
      meta: { version: nextVersion, name: updatedWf.name },
    });

    return {
      workflow: updatedWf,
      publishedVersion,
    };
  }

  async pause(id: string, actorId?: string) {
    const wf = await this.prisma.workflow.findUnique({ where: { id } });
    if (!wf) throw new NotFoundException('مخطط الأتمتة غير موجود');

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        status: 'paused',
        lockVersion: wf.lockVersion + 1,
      },
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.WORKFLOW_PAUSED,
      actorId,
      entity: 'workflow',
      entityId: id,
      meta: { name: updated.name },
    });

    return updated;
  }

  async resume(id: string, actorId?: string) {
    const wf = await this.prisma.workflow.findUnique({
      where: { id },
      include: { versions: { where: { state: 'published' } } },
    });

    if (!wf) throw new NotFoundException('مخطط الأتمتة غير موجود');
    if (wf.versions.length === 0) {
      throw new BadRequestException('لا يمكن تفعيل المخطط قبل نشره أولاً');
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        status: 'published',
        lockVersion: wf.lockVersion + 1,
      },
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.WORKFLOW_RESUMED,
      actorId,
      entity: 'workflow',
      entityId: id,
      meta: { name: updated.name },
    });

    return updated;
  }

  async delete(id: string, actorId?: string) {
    const wf = await this.prisma.workflow.findUnique({ where: { id } });
    if (!wf) throw new NotFoundException('مخطط الأتمتة غير موجود');

    await this.prisma.workflow.delete({ where: { id } });

    await this.audit.record({
      action: AUDIT_ACTIONS.WORKFLOW_DELETED,
      actorId,
      entity: 'workflow',
      entityId: id,
      meta: { name: wf.name },
    });

    return { success: true };
  }

  async listVersions(id: string) {
    const wf = await this.prisma.workflow.findUnique({ where: { id } });
    if (!wf) throw new NotFoundException('مخطط الأتمتة غير موجود');

    return this.prisma.workflowVersion.findMany({
      where: { workflowId: id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        state: true,
        publishedNote: true,
        publishedAt: true,
        createdAt: true,
      },
    });
  }

  async testRun(id: string, dto: TestRunDto) {
    const wf = await this.getById(id);
    const def = (wf.draftDefinition ?? wf.publishedDefinition) as WorkflowDefinition | null;

    if (!def) {
      throw new BadRequestException('لا يوجد مسار معرف للاختبار');
    }

    const trace: Array<{
      nodeId: string;
      nodeType: string;
      status: 'passed' | 'failed' | 'skipped' | 'executed';
      message: string;
    }> = [];

    const nodes = def.nodes;
    const edges = def.edges;
    const text = dto.commentText ?? '';

    const trigger = nodes.find((n) => n.type === 'trigger.comment');
    if (!trigger) {
      return { success: false, reason: 'لا يوجد مشغل', trace };
    }

    trace.push({
      nodeId: trigger.id,
      nodeType: trigger.type,
      status: 'executed',
      message: `تم استقبال التعليق التجريبي: "${text}"`,
    });

    // Walk through graph
    let currentId = trigger.id;
    let keepGoing = true;

    while (keepGoing) {
      const outEdges = edges.filter((e) => e.source === currentId);
      if (outEdges.length === 0) break;

      const nextEdge = outEdges[0];
      if (!nextEdge) break;

      const nextNode = nodes.find((n) => n.id === nextEdge.target);
      if (!nextNode) break;

      currentId = nextNode.id;

      if (nextNode.type === 'condition.text') {
        const data = (nextNode.data ?? {}) as { op?: 'AND' | 'OR'; rules?: Array<{ kind: string; value: string; caseSensitive?: boolean }> };
        const rules = data.rules ?? [];
        const op = data.op ?? 'OR';

        const matches = rules.map((r) => {
          const val = r.caseSensitive ? r.value : r.value.toLowerCase();
          const target = r.caseSensitive ? text : text.toLowerCase();
          if (r.kind === 'text_contains') return target.includes(val);
          if (r.kind === 'text_exact') return target.trim() === val.trim();
          if (r.kind === 'text_excludes') return !target.includes(val);
          return target.includes(val);
        });

        const conditionMet = op === 'AND' ? matches.every(Boolean) : matches.some(Boolean);

        if (conditionMet) {
          trace.push({
            nodeId: nextNode.id,
            nodeType: nextNode.type,
            status: 'passed',
            message: `تحقق الشرط بنجاح (مطابقة: ${rules.map((r) => r.value).join(' أو ')})`,
          });
        } else {
          trace.push({
            nodeId: nextNode.id,
            nodeType: nextNode.type,
            status: 'failed',
            message: 'لم يتحقق الشرط، تم إيقاف المتابعة لهذا الفرع',
          });
          break;
        }
      } else if (nextNode.type === 'action.public_reply') {
        const data = (nextNode.data ?? {}) as { message?: string };
        trace.push({
          nodeId: nextNode.id,
          nodeType: nextNode.type,
          status: 'executed',
          message: `تمت محاكاة إرسال الرد العام بنجاح: "${data.message ?? ''}"`,
        });
      } else if (nextNode.type === 'action.private_reply') {
        const data = (nextNode.data ?? {}) as { message?: string };
        trace.push({
          nodeId: nextNode.id,
          nodeType: nextNode.type,
          status: 'executed',
          message: `تمت محاكاة إرسال الرد في رسالة خاصة بنجاح: "${data.message ?? ''}"`,
        });
      } else if (nextNode.type === 'action.stop') {
        trace.push({
          nodeId: nextNode.id,
          nodeType: nextNode.type,
          status: 'executed',
          message: 'تم إيقاف المخطط بنجاح في العقدة النهائية',
        });
        break;
      }
    }

    return {
      success: true,
      trace,
    };
  }
}

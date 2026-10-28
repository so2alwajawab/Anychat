import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowsService, createDefaultDefinition } from './workflows.service.js';
import type { PrismaService } from '../../common/prisma/prisma.module.js';
import type { AuditService } from '../audit/audit.service.js';
import { runWithOrg } from '../../common/tenancy/org-context.js';

describe('WorkflowsService (Gate G4 Unit Tests)', () => {
  let service: WorkflowsService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      workflow: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      workflowVersion: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      metaConnectedAsset: {
        findMany: vi.fn().mockResolvedValue([{ id: 'asset-1' }]),
      },
      messageTemplate: {
        findMany: vi.fn().mockResolvedValue([{ id: 'tpl-1' }]),
      },
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new WorkflowsService(mockPrisma as unknown as PrismaService, mockAudit as unknown as AuditService);
  });

  it('createWorkflow initializes draft with currentVersion=0, lockVersion=1', async () => {
    mockPrisma.workflow.create.mockResolvedValue({
      id: 'wf-1',
      name: 'مسار تجريبي',
      status: 'draft',
      currentVersion: 0,
      lockVersion: 1,
    });

    // create() stamps the active tenant; unit tests enter the same request
    // context the OrgContextInterceptor would set up in production.
    const result = await runWithOrg('org-test', () =>
      service.create({ name: 'مسار تجريبي' }, 'owner-1'),
    );
    expect(result.id).toBe('wf-1');
    expect(mockPrisma.workflow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-test' }),
      }),
    );
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workflow.created' }),
    );
  });

  it('updateDraft fails with 409 conflict when lockVersion does not match (Gate G4)', async () => {
    mockPrisma.workflow.findUnique.mockResolvedValue({
      id: 'wf-1',
      name: 'مسار',
      lockVersion: 3, // Server has version 3
      versions: [],
    });

    await expect(
      service.updateDraft(
        'wf-1',
        {
          definition: createDefaultDefinition() as any,
          lockVersion: 2, // Client has stale version 2
        },
        'owner-1',
      ),
    ).rejects.toThrow();
  });

  it('publish freezes draft into immutable published version and bumps version (Gate G4)', async () => {
    const validDef = createDefaultDefinition();
    mockPrisma.workflow.findUnique.mockResolvedValue({
      id: 'wf-1',
      name: 'مسار صالح',
      status: 'draft',
      currentVersion: 1,
      lockVersion: 1,
      versions: [
        {
          id: 'v-draft',
          version: 2,
          definition: validDef,
          state: 'draft',
        },
      ],
    });

    mockPrisma.workflowVersion.create.mockResolvedValue({
      id: 'v-published',
      version: 2,
      definition: validDef,
      state: 'published',
    });

    mockPrisma.workflow.update.mockResolvedValue({
      id: 'wf-1',
      status: 'published',
      currentVersion: 2,
      lockVersion: 2,
    });

    const result = await service.publish('wf-1', { publishedNote: 'إطلاق أولي' }, 'owner-1');
    expect(result.workflow.status).toBe('published');
    expect(result.workflow.currentVersion).toBe(2);
    expect(mockPrisma.workflowVersion.updateMany).toHaveBeenCalledWith({
      where: { workflowId: 'wf-1', state: 'published' },
      data: { state: 'archived' },
    });
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workflow.published' }),
    );
  });

  it('pause toggles status to paused (Gate G4)', async () => {
    mockPrisma.workflow.findUnique.mockResolvedValue({
      id: 'wf-1',
      name: 'مسار',
      lockVersion: 2,
      status: 'published',
    });
    mockPrisma.workflow.update.mockResolvedValue({
      id: 'wf-1',
      status: 'paused',
      lockVersion: 3,
    });

    const result = await service.pause('wf-1', 'owner-1');
    expect(result.status).toBe('paused');
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workflow.paused' }),
    );
  });

  it('resume restores status to published (Gate G4)', async () => {
    mockPrisma.workflow.findUnique.mockResolvedValue({
      id: 'wf-1',
      name: 'مسار',
      lockVersion: 3,
      status: 'paused',
      versions: [{ id: 'v-1', state: 'published' }],
    });
    mockPrisma.workflow.update.mockResolvedValue({
      id: 'wf-1',
      status: 'published',
      lockVersion: 4,
    });

    const result = await service.resume('wf-1', 'owner-1');
    expect(result.status).toBe('published');
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workflow.resumed' }),
    );
  });

  it('testRun simulates workflow execution trace without Meta send (Gate G4)', async () => {
    const validDef = createDefaultDefinition();
    mockPrisma.workflow.findUnique.mockResolvedValue({
      id: 'wf-1',
      name: 'مسار',
      versions: [
        {
          id: 'v-1',
          version: 1,
          definition: validDef,
          state: 'published',
        },
      ],
    });

    const result = await service.testRun('wf-1', {
      commentText: 'كم سعر المنتج لو سمحت؟',
    });

    expect(result.success).toBe(true);
    expect(result.trace.length).toBeGreaterThanOrEqual(3);
    expect(result.trace[0]?.status).toBe('executed'); // trigger
    expect(result.trace[1]?.status).toBe('passed'); // condition matched "سعر"
    expect(result.trace[2]?.status).toBe('executed'); // public reply executed
  });

  it('testRun follows false branch when condition fails and false edge exists', async () => {
    const branchDef = {
      schemaVersion: 1,
      nodes: [
        { id: 'node-trigger', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        {
          id: 'node-condition',
          type: 'condition.text',
          position: { x: 0, y: 100 },
          data: { op: 'OR', rules: [{ kind: 'text_contains', value: 'خصم', caseSensitive: false }] },
        },
        {
          id: 'node-fallback-reply',
          type: 'action.public_reply',
          position: { x: 0, y: 200 },
          data: { message: 'شكراً لتواصلك معنا' },
        },
      ],
      edges: [
        { id: 'e1', source: 'node-trigger', target: 'node-condition' },
        { id: 'e2', source: 'node-condition', target: 'node-fallback-reply', sourceHandle: 'false' },
      ],
      settings: {},
    };

    mockPrisma.workflow.findUnique.mockResolvedValue({
      id: 'wf-2',
      name: 'مسار تفرع',
      versions: [{ id: 'v-1', version: 1, definition: branchDef, state: 'published' }],
    });

    const result = await service.testRun('wf-2', { commentText: 'مرحبا بكم' });
    expect(result.success).toBe(true);
    expect(result.trace.length).toBe(3);
    expect(result.trace[0]?.status).toBe('executed');
    expect(result.trace[1]?.status).toBe('failed');
    expect(result.trace[2]?.status).toBe('executed');
    expect(result.trace[2]?.nodeId).toBe('node-fallback-reply');
  });

  it('testRun simulates action.use_template with resolved template text', async () => {
    const tplDef = {
      schemaVersion: 1,
      nodes: [
        { id: 'node-trigger', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        {
          id: 'node-template',
          type: 'action.use_template',
          position: { x: 0, y: 100 },
          data: { templateId: 'tpl-1', templateName: 'قالب الترحيب' },
        },
      ],
      edges: [{ id: 'e1', source: 'node-trigger', target: 'node-template' }],
      settings: {},
    };

    mockPrisma.workflow.findUnique.mockResolvedValue({
      id: 'wf-3',
      name: 'مسار قوالب',
      versions: [{ id: 'v-1', version: 1, definition: tplDef, state: 'published' }],
    });

    mockPrisma.messageTemplate.findUnique = vi.fn().mockResolvedValue({
      id: 'tpl-1',
      body: 'أهلاً وسهلاً بك يا {{commenter_name}}',
    });

    const result = await service.testRun('wf-3', { commentText: 'السلام عليكم' });
    expect(result.success).toBe(true);
    expect(result.trace.length).toBe(2);
    expect(result.trace[1]?.status).toBe('executed');
    expect(result.trace[1]?.message).toContain('قالب الترحيب');
    expect(result.trace[1]?.message).toContain('أهلاً وسهلاً بك');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowsService, createDefaultDefinition } from './workflows.service.js';
import type { PrismaService } from '../../common/prisma/prisma.module.js';
import type { AuditService } from '../audit/audit.service.js';

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

    const result = await service.create({ name: 'مسار تجريبي' }, 'owner-1');
    expect(result.id).toBe('wf-1');
    expect(mockPrisma.workflow.create).toHaveBeenCalled();
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
});

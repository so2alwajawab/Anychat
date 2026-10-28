import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchService } from './match.service.js';

describe('MatchService (Gate G5 Requirements)', () => {
  let service: MatchService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      commentEvent: {
        findUnique: vi.fn(),
      },
      workflow: {
        findMany: vi.fn(),
      },
      executionRun: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new MatchService(mockPrisma, mockAudit);
  });

  it('matches comment event against active published workflow and creates ExecutionRun', async () => {
    mockPrisma.commentEvent.findUnique.mockResolvedValue({
      id: 'c-1',
      platform: 'facebook',
      assetId: 'asset-1',
      text: 'بكم السعر؟',
      authorUsername: 'أحمد',
      parentCommentId: null,
      asset: { id: 'asset-1', displayName: 'Echoes' },
      post: { id: 'p-1', externalId: 'post-100' },
    });

    mockPrisma.workflow.findMany.mockResolvedValue([
      {
        id: 'wf-1',
        name: 'أتمتة الرد على الأسعار',
        status: 'published',
        versions: [
          {
            id: 'v-1',
            version: 1,
            state: 'published',
            definition: {
              schemaVersion: 1,
              nodes: [
                {
                  id: 'n-trig',
                  type: 'trigger.comment',
                  position: { x: 0, y: 0 },
                  data: { platform: 'all', includeReplies: false },
                },
              ],
              edges: [],
            },
          },
        ],
      },
    ]);

    mockPrisma.executionRun.findUnique.mockResolvedValue(null); // No previous run
    mockPrisma.executionRun.create.mockResolvedValue({ id: 'run-1', status: 'pending' });

    const runIds = await service.matchCommentEvent('c-1');
    expect(runIds).toEqual(['run-1']);
    expect(mockPrisma.executionRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowVersionId: 'v-1',
          commentEventId: 'c-1',
          status: 'pending',
        }),
      }),
    );
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'execution.run.started' }),
    );
  });

  it('paused workflow records skipped run with skipReason workflow_paused (Gate G5)', async () => {
    mockPrisma.commentEvent.findUnique.mockResolvedValue({
      id: 'c-2',
      platform: 'facebook',
      assetId: 'asset-1',
      text: 'مرحبا',
      authorUsername: 'محمد',
      parentCommentId: null,
      asset: { id: 'asset-1' },
    });

    mockPrisma.workflow.findMany.mockResolvedValue([
      {
        id: 'wf-paused',
        name: 'مخطط متوقف',
        status: 'paused',
        versions: [
          {
            id: 'v-paused-1',
            version: 1,
            state: 'published',
            definition: {
              schemaVersion: 1,
              nodes: [
                {
                  id: 'n-trig',
                  type: 'trigger.comment',
                  position: { x: 0, y: 0 },
                  data: { platform: 'all' },
                },
              ],
              edges: [],
            },
          },
        ],
      },
    ]);

    mockPrisma.executionRun.findUnique.mockResolvedValue(null);
    mockPrisma.executionRun.create.mockResolvedValue({ id: 'run-skipped', status: 'skipped' });

    const runIds = await service.matchCommentEvent('c-2');
    expect(runIds).toEqual([]); // Did not enqueue for active execution
    expect(mockPrisma.executionRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'skipped',
          skipReason: 'workflow_paused',
        }),
      }),
    );
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'execution.run.skipped' }),
    );
  });

  it('filters out comments when postScope or asset filter does not match', async () => {
    mockPrisma.commentEvent.findUnique.mockResolvedValue({
      id: 'c-3',
      platform: 'facebook',
      assetId: 'asset-999',
      text: 'استفسار',
      parentCommentId: null,
      asset: { id: 'asset-999' },
      post: { id: 'p-1', externalId: 'post-other' },
    });

    mockPrisma.workflow.findMany.mockResolvedValue([
      {
        id: 'wf-scoped',
        name: 'مخطط لمنشور محدد',
        status: 'published',
        versions: [
          {
            id: 'v-scoped',
            version: 1,
            state: 'published',
            definition: {
              schemaVersion: 1,
              nodes: [
                {
                  id: 'n-trig',
                  type: 'trigger.comment',
                  position: { x: 0, y: 0 },
                  data: {
                    platform: 'facebook',
                    postScope: { mode: 'posts', postExternalIds: ['post-only-target'] },
                  },
                },
              ],
              edges: [],
            },
          },
        ],
      },
    ]);

    const runIds = await service.matchCommentEvent('c-3');
    expect(runIds).toEqual([]);
    expect(mockPrisma.executionRun.create).not.toHaveBeenCalled();
  });
});

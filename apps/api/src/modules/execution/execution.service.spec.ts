import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionService, renderVariables } from './execution.service.js';

describe('ExecutionService (Gate G5 Requirements)', () => {
  let service: ExecutionService;
  let mockPrisma: any;
  let mockOutbound: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      executionRun: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      nodeExecution: {
        create: vi.fn(),
      },
      messageTemplate: {
        findUnique: vi.fn(),
      },
    };

    mockOutbound = {
      executePublicReply: vi.fn().mockResolvedValue({
        ok: true,
        actionId: 'act-1',
        remoteMessageId: 'rem-123',
        status: 'sent',
      }),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new ExecutionService(mockPrisma, mockOutbound, mockAudit);
  });

  it('renders variables correctly in template strings', () => {
    const template = 'أهلاً بك يا {{commenter_name}}، بخصوص استفسارك "{{comment_text}}" في صفحة {{page_name}}';
    const rendered = renderVariables(template, {
      commenter_name: 'سارة',
      comment_text: 'كم السعر؟',
      page_name: 'Echoes of Greatness',
    });
    expect(rendered).toBe('أهلاً بك يا سارة، بخصوص استفسارك "كم السعر؟" في صفحة Echoes of Greatness');
  });

  it('executes workflow graph, records node-level timeline, and marks run succeeded (Gate G5)', async () => {
    const workflowDef = {
      schemaVersion: 1,
      nodes: [
        { id: 'node-trig', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        {
          id: 'node-cond',
          type: 'condition.text',
          position: { x: 0, y: 100 },
          data: { op: 'OR', rules: [{ kind: 'text_contains', value: 'سعر', caseSensitive: false }] },
        },
        {
          id: 'node-reply',
          type: 'action.public_reply',
          position: { x: 0, y: 200 },
          data: { message: 'أهلاً بك يا {{commenter_name}}، تم إرسال التفاصيل' },
        },
        { id: 'node-stop', type: 'action.stop', position: { x: 0, y: 300 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 'node-trig', target: 'node-cond' },
        { id: 'e2', source: 'node-cond', target: 'node-reply', sourceHandle: 'true' },
        { id: 'e3', source: 'node-reply', target: 'node-stop' },
      ],
    };

    mockPrisma.executionRun.findUnique.mockResolvedValue({
      id: 'run-success',
      status: 'pending',
      workflowVersion: {
        version: 1,
        definition: workflowDef,
        workflow: { id: 'wf-1', name: 'أتمتة الرد' },
      },
      commentEvent: {
        id: 'c-1',
        platform: 'facebook',
        externalCommentId: 'fb-c-1',
        text: 'كم سعر هذا المنتج؟',
        authorUsername: 'كريم',
        assetId: 'asset-1',
        asset: { id: 'asset-1', displayName: 'Echoes' },
        post: { id: 'p-1', isEligibleForReply: true },
      },
    });

    await service.executeRun('run-success');

    // Node executions were created
    expect(mockPrisma.nodeExecution.create).toHaveBeenCalledTimes(4); // trigger, cond, reply, stop
    expect(mockOutbound.executePublicReply).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-success',
        platform: 'facebook',
        targetCommentId: 'fb-c-1',
        renderedMessage: 'أهلاً بك يا كريم، تم إرسال التفاصيل',
      }),
    );
    expect(mockPrisma.executionRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-success' },
        data: expect.objectContaining({ status: 'succeeded' }),
      }),
    );
  });

  it('eligibility pre-check: can_comment=false causes public reply action to be skipped (Gate G5)', async () => {
    const workflowDef = {
      schemaVersion: 1,
      nodes: [
        { id: 'node-trig', type: 'trigger.comment', position: { x: 0, y: 0 }, data: {} },
        {
          id: 'node-reply',
          type: 'action.public_reply',
          position: { x: 0, y: 100 },
          data: { message: 'رد' },
        },
      ],
      edges: [{ id: 'e1', source: 'node-trig', target: 'node-reply' }],
    };

    mockPrisma.executionRun.findUnique.mockResolvedValue({
      id: 'run-ineligible',
      status: 'pending',
      workflowVersion: {
        version: 1,
        definition: workflowDef,
        workflow: { id: 'wf-1', name: 'أتمتة' },
      },
      commentEvent: {
        id: 'c-2',
        platform: 'facebook',
        externalCommentId: 'fb-c-2',
        text: 'سؤال',
        authorUsername: 'أحمد',
        assetId: 'asset-1',
        asset: { id: 'asset-1', displayName: 'Echoes' },
        post: { id: 'p-2', isEligibleForReply: false }, // ineligible!
      },
    });

    await service.executeRun('run-ineligible');

    // Outbound reply was NOT called!
    expect(mockOutbound.executePublicReply).not.toHaveBeenCalled();
    expect(mockPrisma.nodeExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nodeId: 'node-reply',
          status: 'skipped',
          errorCode: 'CAN_COMMENT_FALSE',
        }),
      }),
    );
  });
});

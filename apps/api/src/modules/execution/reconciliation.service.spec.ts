import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionReconciliationService } from './reconciliation.service.js';

describe('ActionReconciliationService (Gate G5 Crash Recovery)', () => {
  let service: ActionReconciliationService;
  let mockPrisma: any;
  let mockAssets: any;
  let mockGraph: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      outboundAction: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };

    mockAssets = {
      decryptToken: vi.fn().mockResolvedValue('page-token-test'),
    };

    mockGraph = {
      checkCommentReplyExists: vi.fn(),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new ActionReconciliationService(
      mockPrisma,
      mockAssets,
      mockGraph,
      mockAudit,
    );
  });

  it('crash test: worker died after remote send -> reconciliation resolves to sent without duplicate (Gate G5)', async () => {
    mockPrisma.outboundAction.findMany.mockResolvedValue([
      {
        id: 'act-crashed',
        status: 'sending',
        claimedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        targetCommentId: 'c-100',
        remoteMessageId: 'rem-sent-before-crash',
        attemptCount: 1,
        run: {
          commentEvent: {
            platform: 'facebook',
            asset: { id: 'asset-1' },
          },
        },
      },
    ]);

    // Meta confirms the message actually exists on the comment!
    mockGraph.checkCommentReplyExists.mockResolvedValue(true);

    const result = await service.reconcileStuckActions();

    expect(result.reconciledSent).toBe(1);
    expect(result.retried).toBe(0);
    expect(mockPrisma.outboundAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'act-crashed' },
        data: expect.objectContaining({
          status: 'sent',
          reconciledAt: expect.any(Date),
        }),
      }),
    );
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'outbound.action.reconciled' }),
    );
  });

  it('crash test: worker died before network send -> resets to pending for safe retry', async () => {
    mockPrisma.outboundAction.findMany.mockResolvedValue([
      {
        id: 'act-died-early',
        status: 'sending',
        claimedAt: new Date(Date.now() - 5 * 60 * 1000),
        targetCommentId: 'c-200',
        remoteMessageId: null,
        attemptCount: 1,
        run: {
          commentEvent: {
            platform: 'facebook',
            asset: { id: 'asset-1' },
          },
        },
      },
    ]);

    mockGraph.checkCommentReplyExists.mockResolvedValue(false);

    const result = await service.reconcileStuckActions();

    expect(result.retried).toBe(1);
    expect(result.reconciledSent).toBe(0);
    expect(mockPrisma.outboundAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'act-died-early' },
        data: expect.objectContaining({
          status: 'pending',
          fencingToken: null,
        }),
      }),
    );
  });

  it('crash test for private reply: unverifiable stuck action is marked unknown, not auto-retried (Section 9.4)', async () => {
    mockPrisma.outboundAction.findMany.mockResolvedValue([
      {
        id: 'act-priv-stuck',
        actionType: 'private_reply',
        status: 'sending',
        claimedAt: new Date(Date.now() - 5 * 60 * 1000),
        targetCommentId: 'c-priv-99',
        remoteMessageId: null,
        attemptCount: 1,
        run: {
          commentEvent: {
            platform: 'facebook',
            asset: { id: 'asset-1' },
          },
        },
      },
    ]);

    mockGraph.checkCommentReplyExists.mockResolvedValue(false);

    const result = await service.reconcileStuckActions();

    expect(result.failed).toBe(1);
    expect(result.retried).toBe(0);
    expect(mockPrisma.outboundAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'act-priv-stuck' },
        data: expect.objectContaining({
          status: 'unknown',
          lastErrorCode: 'UNVERIFIABLE_PRIVATE_REPLY',
        }),
      }),
    );
  });
});

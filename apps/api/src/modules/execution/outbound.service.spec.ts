import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboundService } from './outbound.service.js';
import { GraphApiError } from '../meta/graph.client.js';

describe('OutboundService (Gate G5 Requirements)', () => {
  let service: OutboundService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockAssets: any;
  let mockGraph: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      outboundAction: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      metaConnectedAsset: {
        update: vi.fn(),
      },
    };

    mockRedis = {
      client: {
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
      },
    };

    mockAssets = {
      decryptToken: vi.fn().mockResolvedValue('decrypted-page-token-123'),
    };

    mockGraph = {
      publishPageCommentReply: vi.fn().mockResolvedValue({ id: 'fb-reply-999' }),
      publishInstagramCommentReply: vi.fn().mockResolvedValue({ id: 'ig-reply-888' }),
      checkCommentReplyExists: vi.fn().mockResolvedValue(true),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new OutboundService(
      mockPrisma,
      mockRedis,
      mockAssets,
      mockGraph,
      mockAudit,
    );
  });

  it('claims action atomically before sending and calls Graph API (Gate G5)', async () => {
    mockPrisma.outboundAction.findUnique.mockResolvedValue(null);
    mockPrisma.outboundAction.create.mockResolvedValue({
      id: 'act-1',
      status: 'pending',
      idempotencyKey: 'public_reply:c-1',
    });
    mockPrisma.outboundAction.updateMany.mockResolvedValue({ count: 1 }); // Won claim!
    mockPrisma.outboundAction.update.mockResolvedValue({ id: 'act-1', status: 'sent' });

    const result = await service.executePublicReply({
      runId: 'run-1',
      assetId: 'asset-1',
      platform: 'facebook',
      targetCommentId: 'c-1',
      renderedMessage: 'أهلاً بك، تم استلام استفسارك',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('sent');
    expect(result.remoteMessageId).toBe('fb-reply-999');
    expect(mockPrisma.outboundAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'act-1', status: 'pending' },
        data: expect.objectContaining({ status: 'sending' }),
      }),
    );
    expect(mockGraph.publishPageCommentReply).toHaveBeenCalledWith(
      'c-1',
      'decrypted-page-token-123',
      'أهلاً بك، تم استلام استفسارك',
    );
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'outbound.action.sent' }),
    );
  });

  it('executes Instagram public reply with publishInstagramCommentReply (Gate G5)', async () => {
    mockPrisma.outboundAction.findUnique.mockResolvedValue(null);
    mockPrisma.outboundAction.create.mockResolvedValue({
      id: 'act-2',
      status: 'pending',
      idempotencyKey: 'public_reply:ig-c-1',
    });
    mockPrisma.outboundAction.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.outboundAction.update.mockResolvedValue({ id: 'act-2', status: 'sent' });

    const result = await service.executePublicReply({
      runId: 'run-2',
      assetId: 'asset-ig',
      platform: 'instagram',
      targetCommentId: 'ig-c-1',
      renderedMessage: 'مرحباً في إنستغرام',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('sent');
    expect(result.remoteMessageId).toBe('ig-reply-888');
    expect(mockGraph.publishInstagramCommentReply).toHaveBeenCalledWith(
      'ig-c-1',
      'decrypted-page-token-123',
      'مرحباً في إنستغرام',
    );
  });

  it('idempotency guard: replay the same webhook 10 times -> exactly one reply (Gate G5)', async () => {
    // 1st time: sends successfully
    mockPrisma.outboundAction.findUnique.mockResolvedValueOnce(null);
    mockPrisma.outboundAction.create.mockResolvedValueOnce({
      id: 'act-first',
      status: 'pending',
      idempotencyKey: 'public_reply:comment-100',
    });
    mockPrisma.outboundAction.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.outboundAction.update.mockResolvedValueOnce({ id: 'act-first', status: 'sent' });

    const firstRun = await service.executePublicReply({
      runId: 'run-1',
      assetId: 'asset-1',
      platform: 'facebook',
      targetCommentId: 'comment-100',
      renderedMessage: 'رد تجريبي',
    });
    expect(firstRun.ok).toBe(true);
    expect(firstRun.status).toBe('sent');

    // Next 9 times: existing action is already 'sent'
    mockPrisma.outboundAction.findUnique.mockResolvedValue({
      id: 'act-first',
      status: 'sent',
      remoteMessageId: 'fb-reply-999',
      idempotencyKey: 'public_reply:comment-100',
    });

    for (let i = 2; i <= 10; i++) {
      const replayResult = await service.executePublicReply({
        runId: `run-${i}`,
        assetId: 'asset-1',
        platform: 'facebook',
        targetCommentId: 'comment-100',
        renderedMessage: 'رد تجريبي',
      });
      expect(replayResult.ok).toBe(true);
      expect(replayResult.status).toBe('skipped');
    }

    // Graph API was called only ONCE!
    expect(mockGraph.publishPageCommentReply).toHaveBeenCalledTimes(1);
  });

  it('rate-limit behavior: simulated 80001/613 error records error without rapid loop (Gate G5)', async () => {
    mockPrisma.outboundAction.findUnique.mockResolvedValue(null);
    mockPrisma.outboundAction.create.mockResolvedValue({
      id: 'act-rl',
      status: 'pending',
      idempotencyKey: 'public_reply:c-rl',
    });
    mockPrisma.outboundAction.updateMany.mockResolvedValue({ count: 1 });

    mockGraph.publishPageCommentReply.mockRejectedValue(
      new GraphApiError(80001, null, 'There have been too many calls to this Page account.'),
    );

    const result = await service.executePublicReply({
      runId: 'run-rl',
      assetId: 'asset-1',
      platform: 'facebook',
      targetCommentId: 'c-rl',
      renderedMessage: 'مرحباً',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('80001');
    expect(mockPrisma.outboundAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'act-rl' },
        data: expect.objectContaining({
          status: 'failed',
          lastErrorCode: '80001',
        }),
      }),
    );
  });
});

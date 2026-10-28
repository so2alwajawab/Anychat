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
        findUnique: vi.fn().mockResolvedValue({
          id: 'asset-1',
          externalId: 'page-ext-100',
          platform: 'facebook',
          linkedPageId: null,
        }),
        update: vi.fn(),
      },
    };

    mockRedis = {
      client: {
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
      },
    };

    // Default for BOTH the atomic claim and every post-claim (fenced) write.
    // Individual tests override this with mockResolvedValueOnce where needed.
    mockPrisma.outboundAction.updateMany.mockResolvedValue({ count: 1 });

    mockAssets = {
      decryptToken: vi.fn().mockResolvedValue('decrypted-page-token-123'),
    };

    mockGraph = {
      publishPageCommentReply: vi.fn().mockResolvedValue({ id: 'fb-reply-999' }),
      publishInstagramCommentReply: vi.fn().mockResolvedValue({ id: 'ig-reply-888' }),
      checkCommentReplyExists: vi.fn().mockResolvedValue(true),
      sendPagePrivateReply: vi.fn().mockResolvedValue({ id: 'mid.fb-msg-123' }),
      sendInstagramPrivateReply: vi.fn().mockResolvedValue({ id: 'mid.ig-msg-456' }),
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
      undefined,
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
    // The failure write must go through the fencing guard, never an unguarded update().
    expect(mockPrisma.outboundAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'act-rl', status: 'sending', fencingToken: expect.any(String) },
        data: expect.objectContaining({
          status: 'failed',
          lastErrorCode: '80001',
        }),
      }),
    );
    expect(mockPrisma.outboundAction.update).not.toHaveBeenCalled();
  });

  it('7-day window guard: comment older than 7 days skips network call with WINDOW_EXPIRED (Gate G6)', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000);

    const result = await service.executePrivateReply({
      runId: 'run-old',
      assetId: 'asset-1',
      platform: 'facebook',
      targetCommentId: 'comment-old-1',
      sourceCreatedAt: eightDaysAgo,
      renderedMessage: 'رسالة خاصة قديمة',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('skipped');
    expect(result.errorCode).toBe('WINDOW_EXPIRED');
    expect(mockGraph.sendPagePrivateReply).not.toHaveBeenCalled();
    expect(mockPrisma.outboundAction.create).not.toHaveBeenCalled();
  });

  it('one-message-per-comment constraint: second attempt blocked before network call (Gate G6)', async () => {
    // 1st attempt: successfully sent
    mockPrisma.outboundAction.findUnique.mockResolvedValueOnce(null);
    mockPrisma.outboundAction.create.mockResolvedValueOnce({
      id: 'act-priv-1',
      status: 'pending',
      idempotencyKey: 'private_reply:comment-single-msg',
    });
    mockPrisma.outboundAction.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.outboundAction.update.mockResolvedValueOnce({ id: 'act-priv-1', status: 'sent' });

    const firstAttempt = await service.executePrivateReply({
      runId: 'run-p1',
      assetId: 'asset-1',
      platform: 'facebook',
      targetCommentId: 'comment-single-msg',
      sourceCreatedAt: new Date(),
      renderedMessage: 'تفاصيل العرض في الخاص',
    });

    expect(firstAttempt.ok).toBe(true);
    expect(firstAttempt.status).toBe('sent');
    expect(mockGraph.sendPagePrivateReply).toHaveBeenCalledTimes(1);

    // 2nd attempt: DB uniqueness guard detects existing sent row
    mockPrisma.outboundAction.findUnique.mockResolvedValue({
      id: 'act-priv-1',
      status: 'sent',
      remoteMessageId: 'mid.fb-msg-123',
      idempotencyKey: 'private_reply:comment-single-msg',
    });

    const secondAttempt = await service.executePrivateReply({
      runId: 'run-p2',
      assetId: 'asset-1',
      platform: 'facebook',
      targetCommentId: 'comment-single-msg',
      sourceCreatedAt: new Date(),
      renderedMessage: 'محاولة إرسال رسالة ثانية لنفس التعليق',
    });

    expect(secondAttempt.status).toBe('skipped');
    // Crucial: Graph API must NOT be called a second time!
    expect(mockGraph.sendPagePrivateReply).toHaveBeenCalledTimes(1);
  });

  it('executes Facebook private reply via sendPagePrivateReply (Gate G6)', async () => {
    mockPrisma.outboundAction.findUnique.mockResolvedValue(null);
    mockPrisma.outboundAction.create.mockResolvedValue({
      id: 'act-fb-priv',
      status: 'pending',
      idempotencyKey: 'private_reply:fb-c-1',
    });
    mockPrisma.outboundAction.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.outboundAction.update.mockResolvedValue({ id: 'act-fb-priv', status: 'sent' });

    const result = await service.executePrivateReply({
      runId: 'run-fb-p',
      assetId: 'asset-1',
      platform: 'facebook',
      targetCommentId: 'fb-c-1',
      sourceCreatedAt: new Date(),
      renderedMessage: 'أهلاً بك، تم إرسال الكتالوج في الخاص',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('sent');
    expect(result.remoteMessageId).toBe('mid.fb-msg-123');
    expect(mockGraph.sendPagePrivateReply).toHaveBeenCalledWith(
      'page-ext-100',
      'decrypted-page-token-123',
      'fb-c-1',
      'أهلاً بك، تم إرسال الكتالوج في الخاص',
      undefined,
    );
  });

  it('executes Instagram private reply via sendInstagramPrivateReply (Gate G6)', async () => {
    mockPrisma.metaConnectedAsset.findUnique.mockResolvedValue({
      id: 'asset-ig-1',
      externalId: 'ig-account-123',
      platform: 'instagram',
      linkedPageId: 'page-linked-456',
    });
    mockPrisma.outboundAction.findUnique.mockResolvedValue(null);
    mockPrisma.outboundAction.create.mockResolvedValue({
      id: 'act-ig-priv',
      status: 'pending',
      idempotencyKey: 'private_reply:ig-c-1',
    });
    mockPrisma.outboundAction.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.outboundAction.update.mockResolvedValue({ id: 'act-ig-priv', status: 'sent' });

    const result = await service.executePrivateReply({
      runId: 'run-ig-p',
      assetId: 'asset-ig-1',
      platform: 'instagram',
      targetCommentId: 'ig-c-1',
      sourceCreatedAt: new Date(),
      renderedMessage: 'تفاصيل المنتج في الخاص',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('sent');
    expect(result.remoteMessageId).toBe('mid.ig-msg-456');
    expect(mockGraph.sendInstagramPrivateReply).toHaveBeenCalledWith(
      'page-linked-456',
      'decrypted-page-token-123',
      'ig-c-1',
      'تفاصيل المنتج في الخاص',
      undefined,
    );
  });

  it('private reply rate budget: exceeding 750/hr blocks network call (Gate G6)', async () => {
    mockRedis.client.incr.mockResolvedValue(751); // Rate budget exhausted
    mockPrisma.outboundAction.findUnique.mockResolvedValue(null);
    mockPrisma.outboundAction.create.mockResolvedValue({
      id: 'act-budget',
      status: 'pending',
      idempotencyKey: 'private_reply:c-budget',
    });
    mockPrisma.outboundAction.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.executePrivateReply({
      runId: 'run-b',
      assetId: 'asset-1',
      platform: 'facebook',
      targetCommentId: 'c-budget',
      sourceCreatedAt: new Date(),
      renderedMessage: 'رسالة',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    expect(mockGraph.sendPagePrivateReply).not.toHaveBeenCalled();
  });

  it('forwards image attachment to Graph API when imageUrl is provided', async () => {
    mockPrisma.metaConnectedAsset.findUnique.mockResolvedValue({
      id: 'asset-img-1',
      externalId: 'page-ext-100',
      platform: 'facebook',
      encryptedAccessToken: 'enc-token-123',
    });
    mockPrisma.outboundAction.findUnique.mockResolvedValue(null);
    mockPrisma.outboundAction.create.mockResolvedValue({
      id: 'act-img',
      status: 'pending',
      idempotencyKey: 'public_reply:c-img-1',
    });
    mockPrisma.outboundAction.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.outboundAction.update.mockResolvedValue({ id: 'act-img', status: 'sent' });

    const result = await service.executePublicReply({
      runId: 'run-img',
      assetId: 'asset-img-1',
      platform: 'facebook',
      targetCommentId: 'c-img-1',
      renderedMessage: 'هذه صورة العرض',
      imageUrl: 'https://example.com/promo.jpg',
    });

    expect(result.ok).toBe(true);
    expect(mockGraph.publishPageCommentReply).toHaveBeenCalledWith(
      'c-img-1',
      'decrypted-page-token-123',
      'هذه صورة العرض',
      'https://example.com/promo.jpg',
    );
  });

  it('fencing: a stale worker can never overwrite a reclaimed action (no unguarded writes)', async () => {
    // Claim is won, then the crash reconciler hands the row to another worker,
    // so our guarded writes find status/fencingToken no longer matching (count 0).
    mockPrisma.outboundAction.findUnique.mockResolvedValue(null);
    mockPrisma.outboundAction.create.mockResolvedValue({
      id: 'act-fence',
      status: 'pending',
      idempotencyKey: 'public_reply:c-fence',
    });
    mockPrisma.outboundAction.updateMany
      .mockResolvedValueOnce({ count: 1 }) // claim won
      .mockResolvedValue({ count: 0 }); // claim lost on every subsequent write

    const result = await service.executePublicReply({
      runId: 'run-fence',
      assetId: 'asset-1',
      platform: 'facebook',
      targetCommentId: 'c-fence',
      renderedMessage: 'رد مُشطَب بـ fencing',
    });

    // The Graph call already happened, so the result still reports it…
    expect(result.ok).toBe(true);
    expect(result.remoteMessageId).toBe('fb-reply-999');

    const calls = mockPrisma.outboundAction.updateMany.mock.calls as [Record<string, any>][];
    expect(calls.length).toBeGreaterThan(1);

    // …but every write after the claim is fenced on status + our own token…
    for (const [args] of calls.slice(1)) {
      expect(args.where).toEqual({
        id: 'act-fence',
        status: 'sending',
        fencingToken: expect.any(String),
      });
    }

    // …and the legacy unguarded update() path must stay dead.
    expect(mockPrisma.outboundAction.update).not.toHaveBeenCalled();
  });
});

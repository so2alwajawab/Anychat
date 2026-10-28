import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { RedisService } from '../../common/redis/redis.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { AssetsService } from '../meta/assets.service.js';
import { GraphApiError, GraphClient } from '../meta/graph.client.js';

export interface ExecuteReplyInput {
  runId: string;
  assetId: string;
  platform: 'facebook' | 'instagram';
  targetCommentId: string;
  renderedMessage: string;
}

export interface ExecuteReplyResult {
  ok: boolean;
  actionId: string;
  remoteMessageId?: string;
  status: 'sent' | 'failed' | 'skipped' | 'unknown';
  errorCode?: string;
  errorMessage?: string;
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80001, 80002]);

@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly assets: AssetsService,
    private readonly graph: GraphClient,
    private readonly audit: AuditService,
  ) {}

  /**
   * Rate limit budget check using Redis sliding window/counter.
   * Allows up to 100 outbound replies per asset per hour as a conservative guardrail.
   */
  async checkRateBudget(assetId: string): Promise<boolean> {
    try {
      const key = `rate_budget:outbound:${assetId}:${Math.floor(Date.now() / 3600000)}`;
      const count = await this.redis.client.incr(key);
      if (count === 1) {
        await this.redis.client.expire(key, 3600);
      }
      return count <= 100;
    } catch {
      // If Redis is temporarily degraded, proceed rather than halting all automation
      return true;
    }
  }

  /**
   * Performs claim-before-send with strict idempotency and executes the public reply via Graph API.
   * Gate G5: Replaying the same webhook 10 times produces exactly one reply.
   */
  async executePublicReply(input: ExecuteReplyInput): Promise<ExecuteReplyResult> {
    const idempotencyKey = `public_reply:${input.targetCommentId}`;
    const fencingToken = randomUUID();

    // 1. Create or retrieve OutboundAction row
    let action = await this.prisma.outboundAction.findUnique({
      where: { idempotencyKey },
    });

    if (action) {
      if (action.status === 'sent') {
        this.logger.log(`Idempotency guard: comment ${input.targetCommentId} already replied (remoteId=${action.remoteMessageId})`);
        return {
          ok: true,
          actionId: action.id,
          remoteMessageId: action.remoteMessageId ?? undefined,
          status: 'skipped',
        };
      }
      if (action.status === 'sending') {
        this.logger.warn(`Idempotency guard: comment ${input.targetCommentId} is currently being sent by another worker`);
        return {
          ok: false,
          actionId: action.id,
          status: 'skipped',
          errorMessage: 'concurrent_in_flight',
        };
      }
    } else {
      try {
        action = await this.prisma.outboundAction.create({
          data: {
            runId: input.runId,
            actionType: 'public_reply',
            idempotencyKey,
            targetCommentId: input.targetCommentId,
            renderedMessage: input.renderedMessage,
            status: 'pending',
          },
        });
      } catch {
        // Unique constraint violation (race condition) -> fetch the existing row
        action = await this.prisma.outboundAction.findUnique({
          where: { idempotencyKey },
        });
        if (!action || action.status === 'sent' || action.status === 'sending') {
          return {
            ok: action?.status === 'sent',
            actionId: action?.id ?? '',
            status: 'skipped',
          };
        }
      }
    }

    if (!action) {
      return { ok: false, actionId: '', status: 'failed', errorMessage: 'action_creation_failed' };
    }

    // 2. Atomic Claim: UPDATE ... WHERE id = :id AND status = 'pending'
    const claimCount = await this.prisma.outboundAction.updateMany({
      where: {
        id: action.id,
        status: 'pending',
      },
      data: {
        status: 'sending',
        fencingToken,
        claimedAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });

    if (claimCount.count === 0) {
      this.logger.warn(`Failed to claim outbound action ${action.id}: already claimed or completed`);
      return { ok: false, actionId: action.id, status: 'skipped' };
    }

    // 3. Pre-flight checks: Rate budget & Token decryption
    const budgetOk = await this.checkRateBudget(input.assetId);
    if (!budgetOk) {
      await this.prisma.outboundAction.update({
        where: { id: action.id },
        data: {
          status: 'failed',
          lastErrorCode: 'RATE_LIMIT_EXCEEDED',
          lastErrorMessage: 'تجاوز معدل الإرسال المسموح به لهذا الحساب',
        },
      });
      return {
        ok: false,
        actionId: action.id,
        status: 'failed',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        errorMessage: 'rate_budget_exhausted',
      };
    }

    let pageToken: string;
    try {
      pageToken = await this.assets.decryptToken(input.assetId);
    } catch (err) {
      await this.prisma.outboundAction.update({
        where: { id: action.id },
        data: {
          status: 'failed',
          lastErrorCode: 'TOKEN_DECRYPT_FAILED',
          lastErrorMessage: (err as Error).message,
        },
      });
      return {
        ok: false,
        actionId: action.id,
        status: 'failed',
        errorCode: 'TOKEN_DECRYPT_FAILED',
        errorMessage: (err as Error).message,
      };
    }

    // 4. Graph API execution
    try {
      let sendResult: { id: string };
      if (input.platform === 'instagram') {
        sendResult = await this.graph.publishInstagramCommentReply(
          input.targetCommentId,
          pageToken,
          input.renderedMessage,
        );
      } else {
        sendResult = await this.graph.publishPageCommentReply(
          input.targetCommentId,
          pageToken,
          input.renderedMessage,
        );
      }

      await this.prisma.outboundAction.update({
        where: { id: action.id },
        data: {
          status: 'sent',
          remoteMessageId: sendResult.id,
          sentAt: new Date(),
        },
      });

      await this.audit.record({
        action: AUDIT_ACTIONS.OUTBOUND_ACTION_SENT,
        entity: 'outbound_action',
        entityId: action.id,
        meta: {
          platform: input.platform,
          targetCommentId: input.targetCommentId,
          remoteMessageId: sendResult.id,
        },
      });

      return {
        ok: true,
        actionId: action.id,
        remoteMessageId: sendResult.id,
        status: 'sent',
      };
    } catch (err: unknown) {
      if (err instanceof GraphApiError) {
        const isRateLimit = RATE_LIMIT_CODES.has(err.code);
        const isAuthError = err.code === 190 || err.code === 200;

        await this.prisma.outboundAction.update({
          where: { id: action.id },
          data: {
            status: 'failed',
            lastErrorCode: String(err.code),
            lastErrorMessage: err.message.slice(0, 300),
          },
        });

        if (isAuthError) {
          await this.prisma.metaConnectedAsset.update({
            where: { id: input.assetId },
            data: { connectionStatus: 'reauth_required' },
          });
          await this.audit.record({
            action: AUDIT_ACTIONS.META_ASSET_HEALTH,
            entity: 'meta_connected_asset',
            entityId: input.assetId,
            outcome: 'failure',
            meta: { code: err.code, reason: 'token_invalid_or_expired' },
          });
        }

        await this.audit.record({
          action: AUDIT_ACTIONS.OUTBOUND_ACTION_FAILED,
          entity: 'outbound_action',
          entityId: action.id,
          outcome: 'failure',
          meta: { code: err.code, isRateLimit, message: err.message },
        });

        return {
          ok: false,
          actionId: action.id,
          status: 'failed',
          errorCode: String(err.code),
          errorMessage: err.message,
        };
      }

      // Ambiguous outcome (e.g. network timeout): mark 'unknown' to avoid duplicate send
      const message = (err as Error).message || 'unknown network error';
      await this.prisma.outboundAction.update({
        where: { id: action.id },
        data: {
          status: 'unknown',
          lastErrorCode: 'NETWORK_TIMEOUT',
          lastErrorMessage: message.slice(0, 300),
        },
      });

      return {
        ok: false,
        actionId: action.id,
        status: 'unknown',
        errorCode: 'NETWORK_TIMEOUT',
        errorMessage: message,
      };
    }
  }
}

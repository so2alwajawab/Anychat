import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { AssetsService } from '../meta/assets.service.js';
import { GraphClient } from '../meta/graph.client.js';

@Injectable()
export class ActionReconciliationService {
  private readonly logger = new Logger(ActionReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly graph: GraphClient,
    private readonly audit: AuditService,
  ) {}

  /**
   * Scans for outbound actions stuck in 'sending' state (worker crash test recovery).
   * Verifies against Meta before any retry to prevent duplicate sends.
   */
  async reconcileStuckActions(): Promise<{ reconciledSent: number; retried: number; failed: number }> {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const stuckActions = await this.prisma.outboundAction.findMany({
      where: {
        status: 'sending',
        claimedAt: { lt: twoMinutesAgo },
      },
      include: {
        run: {
          include: {
            commentEvent: {
              include: { asset: true },
            },
          },
        },
      },
      take: 50,
    });

    let reconciledSent = 0;
    let retried = 0;
    let failed = 0;

    for (const action of stuckActions) {
      const comment = action.run.commentEvent;
      const asset = comment.asset;

      let pageToken = '';
      try {
        pageToken = await this.assets.decryptToken(asset.id);
      } catch {
        // cannot decrypt token
      }

      let existsOnMeta = false;
      if (pageToken && action.remoteMessageId) {
        existsOnMeta = await this.graph.checkCommentReplyExists(
          comment.platform as 'facebook' | 'instagram',
          action.targetCommentId,
          pageToken,
          action.remoteMessageId,
        );
      }

      if (existsOnMeta) {
        await this.prisma.outboundAction.update({
          where: { id: action.id },
          data: {
            status: 'sent',
            reconciledAt: new Date(),
          },
        });

        await this.audit.record({
          action: AUDIT_ACTIONS.OUTBOUND_ACTION_RECONCILED,
          entity: 'outbound_action',
          entityId: action.id,
          meta: { outcome: 'found_on_meta', targetCommentId: action.targetCommentId },
        });

        reconciledSent += 1;
      } else if (action.actionType === 'private_reply') {
        // Section 9.4: Never blindly auto-retry private replies because duplicate DMs are prohibited
        await this.prisma.outboundAction.update({
          where: { id: action.id },
          data: {
            status: 'unknown',
            lastErrorCode: 'UNVERIFIABLE_PRIVATE_REPLY',
            lastErrorMessage: 'تعذر التحقق من وصول الرسالة الخاصة، تم إيقاف المحاولة التلقائية منعاً لتكرار الإرسال',
            reconciledAt: new Date(),
          },
        });
        failed += 1;
      } else if (action.attemptCount >= 3) {
        await this.prisma.outboundAction.update({
          where: { id: action.id },
          data: {
            status: 'failed',
            lastErrorCode: 'MAX_ATTEMPTS_EXCEEDED',
            lastErrorMessage: 'فشلت محاولات الإرسال بعد تكرار الاسترداد',
            reconciledAt: new Date(),
          },
        });
        failed += 1;
      } else {
        // Reset to pending so queue can re-attempt safely
        await this.prisma.outboundAction.update({
          where: { id: action.id },
          data: {
            status: 'pending',
            fencingToken: null,
            reconciledAt: new Date(),
          },
        });
        retried += 1;
      }
    }

    if (stuckActions.length > 0) {
      this.logger.log(
        `Reconciliation complete: ${reconciledSent} resolved sent, ${retried} reset to pending, ${failed} marked failed`,
      );
    }

    return { reconciledSent, retried, failed };
  }
}

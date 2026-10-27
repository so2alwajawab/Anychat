import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module.js';

export interface RetentionReport {
  redactedComments: number;
  deletedDeliveries: number;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run privacy retention policy:
   * 1. Comment text & author data older than 180 days is redacted.
   * 2. WebhookDelivery payloads older than 30 days are deleted.
   */
  async purgeOldData(): Promise<RetentionReport> {
    const now = Date.now();
    const commentRetentionCutoff = new Date(now - 180 * 24 * 60 * 60 * 1000);
    const webhookRetentionCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // 1. Redact comments older than 180 days that still have text
    const redactResult = await this.prisma.commentEvent.updateMany({
      where: {
        sourceCreatedAt: { lte: commentRetentionCutoff },
        text: { not: '' },
      },
      data: {
        text: '',
        authorUsername: null,
        authorScopedId: 'REDACTED',
      },
    });

    // 2. Delete raw webhook deliveries older than 30 days
    const deleteResult = await this.prisma.webhookDelivery.deleteMany({
      where: {
        receivedAt: { lte: webhookRetentionCutoff },
      },
    });

    this.logger.log(
      `Retention cleanup: redacted ${redactResult.count} comments (>180d), deleted ${deleteResult.count} webhook deliveries (>30d).`,
    );

    return {
      redactedComments: redactResult.count,
      deletedDeliveries: deleteResult.count,
    };
  }
}

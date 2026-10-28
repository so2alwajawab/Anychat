import { Module, forwardRef, type OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module.js';
import { RedisModule } from '../../common/redis/redis.module.js';
import { MetaModule } from '../meta/meta.module.js';
import { WebhookService } from '../meta/webhook.service.js';
import { ExecutionModule } from '../execution/execution.module.js';
import { ExecutionQueueService } from '../execution/execution-queue.service.js';
import { ContentController } from './content.controller.js';
import { ContentService } from './content.service.js';
import { IngestQueueService } from './ingest-queue.service.js';
import { NormalizationService } from './normalization.service.js';
import { ReconciliationService } from './reconciliation.service.js';
import { RetentionService } from './retention.service.js';
import { MaintenanceScheduler } from './maintenance.scheduler.js';

@Module({
  imports: [PrismaModule, RedisModule, MetaModule, forwardRef(() => ExecutionModule)],
  controllers: [ContentController],
  providers: [
    NormalizationService,
    IngestQueueService,
    ReconciliationService,
    RetentionService,
    MaintenanceScheduler,
    ContentService,
  ],
  exports: [
    ContentService,
    NormalizationService,
    IngestQueueService,
    ReconciliationService,
    RetentionService,
  ],
})
export class ContentModule implements OnModuleInit {
  constructor(
    private readonly webhooks: WebhookService,
    private readonly ingestQueue: IngestQueueService,
    private readonly normalizer: NormalizationService,
    private readonly executionQueue: ExecutionQueueService,
  ) {}

  onModuleInit(): void {
    this.webhooks.registerDeliveryHook(async (id, hash) => {
      await this.ingestQueue.enqueueDelivery(id, hash);
    });
    this.normalizer.registerCommentHook(async (commentEventId) => {
      await this.executionQueue.enqueueMatch(commentEventId);
    });
  }
}

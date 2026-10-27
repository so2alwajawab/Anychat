import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import { RedisService } from '../../common/redis/redis.module.js';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { NormalizationService } from './normalization.service.js';

export interface IngestJobData {
  deliveryId: string;
  deliveryHash: string;
}

const INGEST_QUEUE_NAME = 'ingest';

@Injectable()
export class IngestQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestQueueService.name);
  private queue: Queue<IngestJobData> | null = null;
  private worker: Worker<IngestJobData> | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly normalizer: NormalizationService,
  ) {}

  onModuleInit(): void {
    const redisClient = this.redis.client;
    // Create dedicated duplicate connections for BullMQ
    const connection = redisClient.options;

    try {
      this.queue = new Queue<IngestJobData>(INGEST_QUEUE_NAME, {
        connection: connection as object,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      });

      this.worker = new Worker<IngestJobData>(
        INGEST_QUEUE_NAME,
        async (job: Job<IngestJobData>) => {
          this.logger.debug(`Processing ingest job ${job.id} for delivery ${job.data.deliveryId}`);
          await this.normalizer.normalizeDelivery(job.data.deliveryId);
        },
        {
          connection: connection as object,
          concurrency: 5,
        },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Ingest job ${job?.id} failed: ${err.message}`, err.stack);
      });

      this.logger.log('BullMQ ingest queue and worker initialized successfully.');
    } catch (err: unknown) {
      this.logger.warn(`Failed to initialize BullMQ worker: ${(err as Error).message}. Will rely on fallback normalization.`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }

  /**
   * Enqueue a webhook delivery for background ingestion.
   * Uses deliveryHash as the jobId so identical duplicate webhook deliveries collapse.
   */
  async enqueueDelivery(deliveryId: string, deliveryHash: string): Promise<void> {
    if (this.queue) {
      try {
        await this.queue.add(
          'normalize',
          { deliveryId, deliveryHash },
          { jobId: `ingest:${deliveryHash}` },
        );
        return;
      } catch (err) {
        this.logger.warn(`Failed to enqueue delivery to BullMQ: ${(err as Error).message}. Processing inline.`);
      }
    }
    // Fallback: direct asynchronous normalization if BullMQ is offline
    void this.normalizer.normalizeDelivery(deliveryId).catch((err) => {
      this.logger.error(`Inline normalization error: ${(err as Error).message}`);
    });
  }

  /**
   * Periodic sweep: recover any WebhookDelivery stuck in 'received' older than 2 minutes.
   */
  async sweepStalled(): Promise<number> {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const stalled = await this.prisma.webhookDelivery.findMany({
      where: {
        processStatus: 'received',
        receivedAt: { lte: twoMinutesAgo },
      },
      take: 50,
    });

    for (const delivery of stalled) {
      await this.enqueueDelivery(delivery.id, delivery.deliveryHash);
    }

    return stalled.length;
  }
}

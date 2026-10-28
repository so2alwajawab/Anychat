import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../../common/redis/redis.module.js';
import { IngestQueueService } from './ingest-queue.service.js';
import { RetentionService } from './retention.service.js';

/**
 * Periodic maintenance jobs.
 *
 * Both jobs below already existed (with unit tests) but nothing ever invoked
 * them: raw webhook payloads grew forever and deliveries whose inline enqueue
 * was swallowed were never recovered. This scheduler is the missing wiring.
 *
 * Every run is guarded by a short Redis NX lock so that running more than one
 * API replica does not execute the same job twice concurrently.
 */
@Injectable()
export class MaintenanceScheduler {
  private readonly logger = new Logger(MaintenanceScheduler.name);

  constructor(
    private readonly redis: RedisService,
    private readonly retention: RetentionService,
    private readonly ingestQueue: IngestQueueService,
  ) {}

  /**
   * Recover WebhookDelivery rows stuck in 'received' (enqueue failed or the
   * process died before BullMQ accepted the job). Runs every 2 minutes, which
   * matches the staleness threshold inside `sweepStalled()`.
   */
  @Cron('0 */2 * * * *')
  async sweepStalledDeliveries(): Promise<void> {
    await this.withLock('maintenance:sweep_stalled', 110, async () => {
      const recovered = await this.ingestQueue.sweepStalled();
      if (recovered > 0) {
        this.logger.log(`Recovered ${recovered} stalled webhook delivery(ies).`);
      }
    });
  }

  /**
   * Privacy retention: redact comment text/author data older than 180 days and
   * delete raw webhook payloads older than 30 days. Daily at 03:15 (backups run
   * at 03:00, so a purge is captured by the next dump).
   */
  @Cron('0 15 3 * * *')
  async runRetentionPurge(): Promise<void> {
    await this.withLock('maintenance:retention_purge', 3600, async () => {
      await this.retention.purgeOldData();
    });
  }

  /**
   * Runs `job` only when this instance wins the Redis NX lock; other replicas
   * skip. Failures are logged and never rethrown so a single bad run cannot
   * poison the scheduler, and the lock is always released afterwards.
   */
  private async withLock(
    lockKey: string,
    ttlSeconds: number,
    job: () => Promise<void>,
  ): Promise<void> {
    let locked = false;

    try {
      const result = await this.redis.client.set(
        lockKey,
        String(process.pid),
        'EX',
        ttlSeconds,
        'NX',
      );
      locked = result === 'OK';
      if (!locked) return;

      await job();
    } catch (err) {
      this.logger.error(`Maintenance job "${lockKey}" failed: ${(err as Error).message}`);
    } finally {
      if (locked) {
        await this.redis.client.del(lockKey).catch(() => undefined);
      }
    }
  }
}

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import { RedisService } from '../../common/redis/redis.module.js';
import { MatchService } from './match.service.js';
import { ExecutionService } from './execution.service.js';
import { ActionReconciliationService } from './reconciliation.service.js';

export interface MatchJobData {
  commentEventId: string;
}

export interface ExecuteJobData {
  runId: string;
}

const MATCH_QUEUE_NAME = 'match';
const EXECUTE_QUEUE_NAME = 'execute';

@Injectable()
export class ExecutionQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExecutionQueueService.name);

  private matchQueue: Queue<MatchJobData> | null = null;
  private matchWorker: Worker<MatchJobData> | null = null;

  private executeQueue: Queue<ExecuteJobData> | null = null;
  private executeWorker: Worker<ExecuteJobData> | null = null;

  private reconcileInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly matcher: MatchService,
    private readonly executor: ExecutionService,
    private readonly reconciler: ActionReconciliationService,
  ) {}

  onModuleInit(): void {
    const connection = this.redis.client.options;

    try {
      // 1. Match Queue & Worker
      this.matchQueue = new Queue<MatchJobData>(MATCH_QUEUE_NAME, {
        connection: connection as object,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      });

      this.matchWorker = new Worker<MatchJobData>(
        MATCH_QUEUE_NAME,
        async (job: Job<MatchJobData>) => {
          this.logger.debug(`Matching comment event: ${job.data.commentEventId}`);
          const runIds = await this.matcher.matchCommentEvent(job.data.commentEventId);
          for (const runId of runIds) {
            await this.enqueueExecution(runId);
          }
        },
        { connection: connection as object, concurrency: 5 },
      );

      // 2. Execute Queue & Worker
      this.executeQueue = new Queue<ExecuteJobData>(EXECUTE_QUEUE_NAME, {
        connection: connection as object,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      });

      this.executeWorker = new Worker<ExecuteJobData>(
        EXECUTE_QUEUE_NAME,
        async (job: Job<ExecuteJobData>) => {
          this.logger.debug(`Executing workflow run: ${job.data.runId}`);
          await this.executor.executeRun(job.data.runId);
        },
        { connection: connection as object, concurrency: 2 },
      );

      // 3. Periodic crash-test reconciliation (every 2 minutes)
      this.reconcileInterval = setInterval(() => {
        this.reconciler.reconcileStuckActions().catch((err: unknown) => {
          this.logger.error(`Reconciliation run failed: ${(err as Error).message}`);
        });
      }, 120_000);

      this.logger.log('Execution BullMQ workers and queues initialized successfully.');
    } catch (err: unknown) {
      this.logger.warn(`Failed to initialize Execution BullMQ: ${(err as Error).message}. Inline fallback active.`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconcileInterval) clearInterval(this.reconcileInterval);
    if (this.matchWorker) await this.matchWorker.close();
    if (this.matchQueue) await this.matchQueue.close();
    if (this.executeWorker) await this.executeWorker.close();
    if (this.executeQueue) await this.executeQueue.close();
  }

  /**
   * Enqueues a comment event for workflow matching.
   */
  async enqueueMatch(commentEventId: string): Promise<void> {
    if (this.matchQueue) {
      try {
        await this.matchQueue.add(
          'match_comment',
          { commentEventId },
          { jobId: `match:${commentEventId}` },
        );
        return;
      } catch (err) {
        this.logger.warn(`Failed to enqueue match job: ${(err as Error).message}. Processing inline.`);
      }
    }

    // Inline fallback
    const runIds = await this.matcher.matchCommentEvent(commentEventId);
    for (const runId of runIds) {
      await this.enqueueExecution(runId);
    }
  }

  /**
   * Enqueues a workflow run for execution.
   */
  async enqueueExecution(runId: string): Promise<void> {
    if (this.executeQueue) {
      try {
        await this.executeQueue.add(
          'execute_run',
          { runId },
          { jobId: `execute:${runId}` },
        );
        return;
      } catch (err) {
        this.logger.warn(`Failed to enqueue execute job: ${(err as Error).message}. Processing inline.`);
      }
    }

    // Inline fallback
    await this.executor.executeRun(runId);
  }
}

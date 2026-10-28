import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { MetaModule } from '../meta/meta.module.js';
import { OutboundService } from './outbound.service.js';
import { MatchService } from './match.service.js';
import { ExecutionService } from './execution.service.js';
import { ActionReconciliationService } from './reconciliation.service.js';
import { ExecutionQueueService } from './execution-queue.service.js';
import { RunsController } from './runs.controller.js';

@Module({
  imports: [AuditModule, MetaModule],
  controllers: [RunsController],
  providers: [
    OutboundService,
    MatchService,
    ExecutionService,
    ActionReconciliationService,
    ExecutionQueueService,
  ],
  exports: [ExecutionQueueService, MatchService, ExecutionService, OutboundService],
})
export class ExecutionModule {}

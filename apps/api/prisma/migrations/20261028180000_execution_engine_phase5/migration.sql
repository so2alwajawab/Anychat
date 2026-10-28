-- CreateTable
CREATE TABLE "execution_run" (
    "id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "comment_event_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "skip_reason" TEXT,
    "context_snapshot" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_execution" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "node_id" TEXT NOT NULL,
    "node_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'executed',
    "input_summary" JSONB,
    "output_summary" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "node_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_action" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "action_type" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "target_comment_id" TEXT NOT NULL,
    "rendered_message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remote_message_id" TEXT,
    "fencing_token" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "claimed_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "execution_run_workflow_version_id_comment_event_id_key" ON "execution_run"("workflow_version_id", "comment_event_id");

-- CreateIndex
CREATE INDEX "execution_run_workflow_version_id_started_at_idx" ON "execution_run"("workflow_version_id", "started_at");

-- CreateIndex
CREATE INDEX "execution_run_status_idx" ON "execution_run"("status");

-- CreateIndex
CREATE INDEX "execution_run_comment_event_id_idx" ON "execution_run"("comment_event_id");

-- CreateIndex
CREATE INDEX "node_execution_run_id_idx" ON "node_execution"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_action_idempotency_key_key" ON "outbound_action"("idempotency_key");

-- CreateIndex
CREATE INDEX "outbound_action_status_idx" ON "outbound_action"("status");

-- CreateIndex
CREATE INDEX "outbound_action_target_comment_id_idx" ON "outbound_action"("target_comment_id");

-- CreateIndex
CREATE INDEX "outbound_action_run_id_idx" ON "outbound_action"("run_id");

-- AddForeignKey
ALTER TABLE "execution_run" ADD CONSTRAINT "execution_run_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_run" ADD CONSTRAINT "execution_run_comment_event_id_fkey" FOREIGN KEY ("comment_event_id") REFERENCES "comment_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_execution" ADD CONSTRAINT "node_execution_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "execution_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_action" ADD CONSTRAINT "outbound_action_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "execution_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

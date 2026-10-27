-- CreateTable
CREATE TABLE "workflow" (
    "id" UUID NOT NULL,
    "asset_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_version" INTEGER NOT NULL DEFAULT 0,
    "lock_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_version" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "published_note" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_template" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "allowed_variables" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_asset_id_idx" ON "workflow"("asset_id");

-- CreateIndex
CREATE INDEX "workflow_status_idx" ON "workflow"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_version_workflow_id_version_key" ON "workflow_version"("workflow_id", "version");

-- CreateIndex
CREATE INDEX "workflow_version_workflow_id_state_idx" ON "workflow_version"("workflow_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "message_template_name_key" ON "message_template"("name");

-- AddForeignKey
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "meta_connected_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "post" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "message_preview" TEXT,
    "created_time" TIMESTAMP(3) NOT NULL,
    "permalink" TEXT,
    "is_eligible_for_reply" BOOLEAN NOT NULL DEFAULT true,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_event" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "post_id" UUID,
    "platform" TEXT NOT NULL,
    "external_comment_id" TEXT NOT NULL,
    "parent_comment_id" TEXT,
    "author_scoped_id" TEXT NOT NULL,
    "author_username" TEXT,
    "text" TEXT NOT NULL,
    "source_created_at" TIMESTAMP(3) NOT NULL,
    "raw_payload_ref" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" TEXT NOT NULL DEFAULT 'inbound',

    CONSTRAINT "comment_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_platform_external_id_key" ON "post"("platform", "external_id");

-- CreateIndex
CREATE INDEX "post_asset_id_idx" ON "post"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "comment_event_dedupe_key_key" ON "comment_event"("dedupe_key");

-- CreateIndex
CREATE INDEX "comment_event_asset_id_source_created_at_idx" ON "comment_event"("asset_id", "source_created_at");

-- CreateIndex
CREATE INDEX "comment_event_post_id_idx" ON "comment_event"("post_id");

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "meta_connected_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_event" ADD CONSTRAINT "comment_event_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "meta_connected_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_event" ADD CONSTRAINT "comment_event_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

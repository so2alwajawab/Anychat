-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_subscription_asset_id_object_key" ON "webhook_subscription"("asset_id", "object");

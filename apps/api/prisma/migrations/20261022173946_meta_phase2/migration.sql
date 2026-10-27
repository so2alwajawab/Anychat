-- CreateTable
CREATE TABLE "meta_app_config" (
    "id" UUID NOT NULL,
    "app_id" TEXT NOT NULL,
    "app_secret_cipher" TEXT NOT NULL,
    "webhook_verify_token_cipher" TEXT NOT NULL,
    "graph_api_version" TEXT NOT NULL DEFAULT 'v26.0',
    "appsecret_proof_enabled" BOOLEAN NOT NULL DEFAULT true,
    "rotated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_app_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_connected_asset" (
    "id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "linked_page_id" TEXT,
    "permissions_granted" JSONB NOT NULL DEFAULT '[]',
    "connection_status" TEXT NOT NULL DEFAULT 'connected',
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_health_check_at" TIMESTAMP(3),

    CONSTRAINT "meta_connected_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_credential" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "key_version" TEXT NOT NULL,
    "granted_scopes" JSONB NOT NULL DEFAULT '[]',
    "expires_at" TIMESTAMP(3),
    "last_validated_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "meta_credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscription" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "object" TEXT NOT NULL,
    "subscribed_fields" JSONB NOT NULL DEFAULT '[]',
    "subscription_status" TEXT NOT NULL DEFAULT 'pending',
    "last_event_at" TIMESTAMP(3),
    "last_verified_at" TIMESTAMP(3),
    "diagnostics" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery" (
    "id" UUID NOT NULL,
    "delivery_hash" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature_status" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "process_status" TEXT NOT NULL DEFAULT 'received',

    CONSTRAINT "webhook_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_connected_asset_external_id_key" ON "meta_connected_asset"("external_id");

-- CreateIndex
CREATE INDEX "meta_connected_asset_platform_idx" ON "meta_connected_asset"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "meta_credential_asset_id_key" ON "meta_credential"("asset_id");

-- CreateIndex
CREATE INDEX "webhook_subscription_asset_id_idx" ON "webhook_subscription"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_delivery_delivery_hash_key" ON "webhook_delivery"("delivery_hash");

-- CreateIndex
CREATE INDEX "webhook_delivery_received_at_idx" ON "webhook_delivery"("received_at" DESC);

-- AddForeignKey
ALTER TABLE "meta_credential" ADD CONSTRAINT "meta_credential_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "meta_connected_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_subscription" ADD CONSTRAINT "webhook_subscription_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "meta_connected_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

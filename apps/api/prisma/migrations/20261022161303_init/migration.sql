-- CreateTable
CREATE TABLE "owner_account" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMP(3),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_session" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_token_hash" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "absolute_expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_prefix" TEXT,
    "user_agent_hash" TEXT,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "owner_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_recovery" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "password_recovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_type" TEXT NOT NULL DEFAULT 'owner',
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entity_id" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'success',
    "ip" TEXT,
    "user_agent" TEXT,
    "meta" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "owner_account_username_key" ON "owner_account"("username");

-- CreateIndex
CREATE UNIQUE INDEX "owner_session_token_hash_key" ON "owner_session"("token_hash");

-- CreateIndex
CREATE INDEX "owner_session_owner_id_idx" ON "owner_session"("owner_id");

-- CreateIndex
CREATE INDEX "owner_session_expires_at_idx" ON "owner_session"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_recovery_code_hash_key" ON "password_recovery"("code_hash");

-- CreateIndex
CREATE INDEX "password_recovery_owner_id_idx" ON "password_recovery"("owner_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- AddForeignKey
ALTER TABLE "owner_session" ADD CONSTRAINT "owner_session_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owner_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_recovery" ADD CONSTRAINT "password_recovery_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owner_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

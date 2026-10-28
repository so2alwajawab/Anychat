-- ==============================================================================
-- Identity & tenancy (Phase 1)
--
-- Turns the single-owner tool into a multi-tenant SaaS:
--   * Adds email to owner_account so customers can sign up with email OR username.
--   * Introduces `organization` (the tenant / isolation boundary) and
--     `membership` (a user's role inside an organization).
--   * Adds a non-null organization_id to every tenant-scoped table, backfilled
--     from a single bootstrap organization for the pre-existing single-owner data.
--
-- The bootstrap/backfill is guarded so that a brand-new, empty database simply
-- skips it: there is nothing to attach, and the NOT NULL constraints still hold.
-- ==============================================================================

-- 1) Email-based signup columns on the existing account table.
ALTER TABLE "owner_account" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "owner_account" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);

-- 2) Tenancy tables.
CREATE TABLE IF NOT EXISTS "organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "membership" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

-- 3) Add organization_id as NULLABLE first so existing rows can be backfilled
--    before the NOT NULL constraint is enforced.
ALTER TABLE "meta_connected_asset" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "webhook_subscription" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "webhook_delivery"     ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "post"                 ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "comment_event"        ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "workflow"             ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "message_template"     ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "execution_run"        ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "audit_log"            ADD COLUMN IF NOT EXISTS "organization_id" UUID;

-- 4) Bootstrap a single organization for all pre-existing data and backfill.
--    Runs only when there is at least one row that needs an organization:
--      * any legacy owner_account row, or
--      * any row in a tenant-scoped table still missing an organization_id.
--    On a fresh database this block is a no-op and no org is created.
DO $$
DECLARE
    bootstrap_org_id UUID;
    has_tenanted_rows BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM "owner_account"
        UNION ALL SELECT 1 FROM "meta_connected_asset" WHERE "organization_id" IS NULL
        UNION ALL SELECT 1 FROM "webhook_subscription" WHERE "organization_id" IS NULL
        UNION ALL SELECT 1 FROM "post"                 WHERE "organization_id" IS NULL
        UNION ALL SELECT 1 FROM "comment_event"        WHERE "organization_id" IS NULL
        UNION ALL SELECT 1 FROM "workflow"             WHERE "organization_id" IS NULL
        UNION ALL SELECT 1 FROM "message_template"     WHERE "organization_id" IS NULL
        UNION ALL SELECT 1 FROM "execution_run"        WHERE "organization_id" IS NULL
        UNION ALL SELECT 1 FROM "audit_log"            WHERE "organization_id" IS NULL
        UNION ALL SELECT 1 FROM "webhook_delivery"     WHERE "organization_id" IS NULL
        LIMIT 1
    ) INTO has_tenanted_rows;

    -- Nothing to migrate on an empty database.
    IF NOT has_tenanted_rows THEN
        RETURN;
    END IF;

    bootstrap_org_id := gen_random_uuid();

    -- The bootstrap org is a renameable placeholder; the customer can change it
    -- from account settings in a later phase.
    INSERT INTO "organization" ("id", "name", "status", "updated_at")
    VALUES (bootstrap_org_id, 'Default Organization', 'active', CURRENT_TIMESTAMP);

    -- Every pre-existing account becomes an owner of the bootstrap organization
    -- so the legacy single-owner keeps full access to all migrated data.
    -- (membership is empty within this migration, so no conflict is possible;
    -- the unique index on (user_id, organization_id) is created after this block.)
    INSERT INTO "membership" ("id", "user_id", "organization_id", "role")
    SELECT gen_random_uuid(), "id", bootstrap_org_id, 'owner'
    FROM "owner_account";

    -- Point every existing row at the bootstrap organization.
    UPDATE "meta_connected_asset" SET "organization_id" = bootstrap_org_id WHERE "organization_id" IS NULL;
    UPDATE "webhook_subscription" SET "organization_id" = bootstrap_org_id WHERE "organization_id" IS NULL;
    UPDATE "post"                 SET "organization_id" = bootstrap_org_id WHERE "organization_id" IS NULL;
    UPDATE "comment_event"        SET "organization_id" = bootstrap_org_id WHERE "organization_id" IS NULL;
    UPDATE "workflow"             SET "organization_id" = bootstrap_org_id WHERE "organization_id" IS NULL;
    UPDATE "message_template"     SET "organization_id" = bootstrap_org_id WHERE "organization_id" IS NULL;
    UPDATE "execution_run"        SET "organization_id" = bootstrap_org_id WHERE "organization_id" IS NULL;
    -- audit_log / webhook_delivery keep organization_id nullable by design
    -- (system-level rows may have none), but we still backfill legacy rows.
    UPDATE "audit_log"            SET "organization_id" = bootstrap_org_id WHERE "organization_id" IS NULL;
    UPDATE "webhook_delivery"     SET "organization_id" = bootstrap_org_id WHERE "organization_id" IS NULL;
END $$;

-- 5) Enforce NOT NULL on the tables where every row must belong to an org.
--    (audit_log and webhook_delivery stay nullable on purpose.)
ALTER TABLE "meta_connected_asset" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "webhook_subscription" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "post"                 ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "comment_event"        ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "workflow"             ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "message_template"     ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "execution_run"        ALTER COLUMN "organization_id" SET NOT NULL;

-- 6) Template names are now unique PER organization, not globally.
DROP INDEX IF EXISTS "message_template_name_key";

-- 7) Indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "owner_account_email_key" ON "owner_account"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "message_template_organization_id_name_key" ON "message_template"("organization_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "membership_user_id_organization_id_key" ON "membership"("user_id", "organization_id");

CREATE INDEX IF NOT EXISTS "membership_organization_id_idx"            ON "membership"("organization_id");
CREATE INDEX IF NOT EXISTS "meta_connected_asset_organization_id_idx"  ON "meta_connected_asset"("organization_id");
CREATE INDEX IF NOT EXISTS "webhook_subscription_organization_id_idx"  ON "webhook_subscription"("organization_id");
CREATE INDEX IF NOT EXISTS "webhook_delivery_organization_id_idx"      ON "webhook_delivery"("organization_id");
CREATE INDEX IF NOT EXISTS "post_organization_id_idx"                  ON "post"("organization_id");
CREATE INDEX IF NOT EXISTS "comment_event_organization_id_idx"         ON "comment_event"("organization_id");
CREATE INDEX IF NOT EXISTS "workflow_organization_id_idx"              ON "workflow"("organization_id");
CREATE INDEX IF NOT EXISTS "execution_run_organization_id_idx"         ON "execution_run"("organization_id");
CREATE INDEX IF NOT EXISTS "audit_log_organization_id_idx"             ON "audit_log"("organization_id");

-- 8) Foreign keys.
ALTER TABLE "membership"
    ADD CONSTRAINT "membership_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "owner_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "membership"
    ADD CONSTRAINT "membership_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meta_connected_asset"
    ADD CONSTRAINT "meta_connected_asset_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_subscription"
    ADD CONSTRAINT "webhook_subscription_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_delivery"
    ADD CONSTRAINT "webhook_delivery_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "post"
    ADD CONSTRAINT "post_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comment_event"
    ADD CONSTRAINT "comment_event_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow"
    ADD CONSTRAINT "workflow_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_template"
    ADD CONSTRAINT "message_template_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "execution_run"
    ADD CONSTRAINT "execution_run_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_log"
    ADD CONSTRAINT "audit_log_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Onboarding wizard (Phase 2)
--
-- Tracks a new customer's progress through the first-run flow:
--   welcome -> connect (Meta OAuth) -> template (first automation) -> done
--
-- The wizard state lives on the organization because onboarding is a property
-- of the tenant/workspace, not of an individual user.
-- =============================================================================

ALTER TABLE "organization"
    ADD COLUMN IF NOT EXISTS "onboarding_step" TEXT NOT NULL DEFAULT 'welcome';

ALTER TABLE "organization"
    ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMP(3);

-- Organizations that already exist predate the wizard (the backfilled legacy
-- workspace and anything created before this migration). Mark them onboarded so
-- existing customers are never forced through a first-run flow they already
-- lived without. New signups start at 'welcome' (the column default).
UPDATE "organization"
SET "onboarding_step" = 'done',
    "onboarding_completed_at" = CURRENT_TIMESTAMP
WHERE "onboarding_completed_at" IS NULL;

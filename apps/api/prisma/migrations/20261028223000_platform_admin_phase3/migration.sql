-- =============================================================================
-- Platform admin role (Phase 3 — admin dashboard)
--
-- `owner_account.platform_role` is the PLATFORM-wide authorization flag that
-- gates the cross-tenant admin dashboard. It is deliberately separate from
-- `membership.role` (per-organization role, reserved for team access):
--   'member'  = normal tenant owner (default)
--   'admin'   = may read cross-tenant platform metrics via /api/v1/admin/*
--
-- Nobody is promoted here: the API bootstraps admins from the
-- PLATFORM_ADMIN_USERNAMES env allowlist (idempotent, audited).
-- =============================================================================

ALTER TABLE "owner_account"
    ADD COLUMN IF NOT EXISTS "platform_role" TEXT NOT NULL DEFAULT 'member';

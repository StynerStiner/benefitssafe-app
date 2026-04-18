-- BSRS Ch 5 P3 — time-boxed role grants for CPA-season + temp workers.
-- All columns are NULLable so every existing OrganizationMembership row
-- is implicitly a permanent grant (expiresAt = NULL means permanent).
-- No data backfill required. New index powers the hourly revoke cron's
-- WHERE expiresAt < now() AND revokedAt IS NULL AND status = 'active' sweep.
--
-- See docs/design-notes/bsrs-ch05-least-privilege-applied.md §P3.

ALTER TABLE "OrganizationMembership"
  ADD COLUMN "expiresAt"   TIMESTAMP(3),
  ADD COLUMN "grantedBy"   TEXT,
  ADD COLUMN "grantReason" TEXT,
  ADD COLUMN "revokedAt"   TIMESTAMP(3),
  ADD COLUMN "revokedBy"   TEXT;

CREATE INDEX "OrganizationMembership_expiresAt_status_idx"
  ON "OrganizationMembership" ("expiresAt", "status");

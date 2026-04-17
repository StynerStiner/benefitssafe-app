-- Migration: add_org_code_to_organization
-- Generated: 2026-04-16
-- Scope: Add orgCode column (required by generateMembershipCode
--        in lib/utils/membership-code.ts which the existing
--        seed scripts/seed-test-users.ts invokes).
--
-- IN SCOPE: Organization.orgCode (nullable, @unique)
-- OUT OF SCOPE: all other drifted columns (Path B)
--
-- Safety: column is nullable -- existing rows get NULL. Unique
--         index is safe because NULLs don't collide in
--         Postgres unique indexes.

-- Add orgCode column
ALTER TABLE "Organization" ADD COLUMN "orgCode" TEXT;

-- Unique index
CREATE UNIQUE INDEX "Organization_orgCode_key" ON "Organization"("orgCode");

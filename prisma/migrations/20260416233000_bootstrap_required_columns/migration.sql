-- Migration: bootstrap_required_columns
-- Generated: 2026-04-16
-- Scope: Add declared-but-missing columns on Organization and User
--        so Prisma writes (upsert/create/update) succeed. Required
--        for bootstrap-test-environment.ts to run without P2022.
--
-- IN SCOPE:
--   Organization: 7 columns
--   User: 17 columns + 2 unique indexes
-- OUT OF SCOPE (Path B, separate migration):
--   15 other drifted tables (Conversation, Message, Notification, etc)
--   Index rebuilds
--   6 NOT NULL organizationId backfills on existing tables
--
-- Safety: Aurora has 0 rows in Organization and User at migration
--         time. Every NOT NULL column has a DEFAULT, so migration
--         is also safe on future non-empty tables.

-- ============================================================
-- Organization columns (7)
-- ============================================================
ALTER TABLE "Organization" ADD COLUMN "is_platform_org" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "einVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "stripeFinancialAccountId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "stripeOriginPaymentMethodId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "bankConnectedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN "trialStartDate" TIMESTAMP(3);

-- ============================================================
-- User columns (17)
-- ============================================================
ALTER TABLE "User" ADD COLUMN "emailVerifyToken" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerifyExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaBackupCodes" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN "lastLoginIp" TEXT;
ALTER TABLE "User" ADD COLUMN "lastLoginUserAgent" TEXT;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "trustedDevices" JSONB;
ALTER TABLE "User" ADD COLUMN "alert_preferences" JSONB;
ALTER TABLE "User" ADD COLUMN "beneficiaryCode" TEXT;
ALTER TABLE "User" ADD COLUMN "title" TEXT;
ALTER TABLE "User" ADD COLUMN "companyName" TEXT;
ALTER TABLE "User" ADD COLUMN "businessAddress" TEXT;
ALTER TABLE "User" ADD COLUMN "firmName" TEXT;
ALTER TABLE "User" ADD COLUMN "licenseNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "barNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "organizationName" TEXT;

-- ============================================================
-- Unique indexes (2)
-- ============================================================
CREATE UNIQUE INDEX "User_emailVerifyToken_key" ON "User"("emailVerifyToken");
CREATE UNIQUE INDEX "User_beneficiaryCode_key" ON "User"("beneficiaryCode");

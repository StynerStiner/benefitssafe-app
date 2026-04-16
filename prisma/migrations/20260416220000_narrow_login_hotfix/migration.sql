-- Migration: narrow_login_hotfix
-- Generated: 2026-04-16 (manual, from prisma migrate diff output)
-- Scope: restore login + populate session org/billing data
--
-- IN SCOPE:
--   User:         +avatarUrl, +mfaEnabled, +emailVerified
--   Organization: +subscriptionStatus, +trialEndDate
--   NEW TABLES:   OrganizationMembership, BillingSubscription
--
-- EXPLICITLY OUT OF SCOPE (see Path B):
--   15 other missing tables, 58 other missing columns,
--   6 NOT NULL organizationId backfills, index rebuilds
--
-- Safety: all ALTER TABLE ADD COLUMN use nullable or defaulted
--        columns (safe on existing data). Both new tables are
--        empty at creation. All FK constraints reference tables
--        that already exist in Aurora (User, Organization).

-- ============================================================
-- User columns
-- ============================================================
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- Organization columns
-- ============================================================
ALTER TABLE "Organization" ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE "Organization" ADD COLUMN "trialEndDate" TIMESTAMP(3);

-- ============================================================
-- OrganizationMembership table
-- ============================================================
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "memberCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "invitedBy" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDefaultOrg" BOOLEAN NOT NULL DEFAULT false,
    "lastAccessedAt" TIMESTAMP(3),
    "orgSpecificTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationMembership_memberCode_key" ON "OrganizationMembership"("memberCode");
CREATE INDEX "OrganizationMembership_userId_status_idx" ON "OrganizationMembership"("userId", "status");
CREATE INDEX "OrganizationMembership_organizationId_status_role_idx" ON "OrganizationMembership"("organizationId", "status", "role");
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");

-- ============================================================
-- BillingSubscription table
-- ============================================================
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'trialing',
    "lastBillingEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingSubscription_organizationId_key" ON "BillingSubscription"("organizationId");
CREATE INDEX "BillingSubscription_stripeCustomerId_idx" ON "BillingSubscription"("stripeCustomerId");
CREATE INDEX "BillingSubscription_stripeSubscriptionId_idx" ON "BillingSubscription"("stripeSubscriptionId");

-- ============================================================
-- Foreign keys
-- ============================================================
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

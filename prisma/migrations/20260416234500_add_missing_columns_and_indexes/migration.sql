-- Migration: add_missing_columns_and_indexes
-- Generated: 2026-04-16
-- Scope: Add 33 declared-but-missing columns on 12 existing tables
--        + supporting indexes tied to the new columns.
--        Final Path B migration — after this, Aurora matches
--        schema.prisma for every declared model field on the
--        tables the diagnostic flagged.
--
-- IN SCOPE:
--   Columns (33 across 12 tables):
--     Approval: 1               LedgerEntry: 1
--     AuditLog: 1                Subscription: 1
--     BudgetCategory: 1          Transaction: 3
--     DisbursementPolicy: 5      Vendor: 1
--     Document: 1                VirtualCard: 8
--     ExpenseRequest: 5          Grant: 5
--
--   Indexes (10 CREATE INDEX + 2 CREATE UNIQUE INDEX):
--     All tied to new columns added above. Other index drift
--     (schema-declared composites missing on columns that
--     already exist, e.g. AuditLog composites, Grant
--     orgId-status/orgId-createdAt composites) is OUT OF SCOPE
--     for this migration — diagnostic tracked column drift, not
--     pre-existing index drift on previously-existing columns.
--
-- OUT OF SCOPE:
--   New tables (handled in Migration 1: 20260416234000)
--   Pre-existing index drift unrelated to new columns
--
-- Safety: 6 NOT NULL-without-DEFAULT ADD COLUMN statements are
--         all on tables confirmed row-count = 0 at diagnostic
--         time (Approval, BudgetCategory, ExpenseRequest,
--         LedgerEntry, Subscription, Transaction). Postgres
--         rejects NOT NULL-without-DEFAULT only when existing
--         rows exist — empty tables make this safe.
--         All other NOT NULL columns have explicit DEFAULTs.

-- ============================================================
-- Approval (1 col, orgId hazard)
-- ============================================================
ALTER TABLE "Approval" ADD COLUMN "organizationId" TEXT NOT NULL;

-- ============================================================
-- AuditLog (1 col)
-- ============================================================
ALTER TABLE "AuditLog" ADD COLUMN "userAgent" TEXT;

-- ============================================================
-- BudgetCategory (1 col, orgId hazard)
-- ============================================================
ALTER TABLE "BudgetCategory" ADD COLUMN "organizationId" TEXT NOT NULL;

-- ============================================================
-- DisbursementPolicy (5 cols)
-- ============================================================
ALTER TABLE "DisbursementPolicy" ADD COLUMN "autoApproveEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DisbursementPolicy" ADD COLUMN "autoApproveMaxAmount" DECIMAL(12,2);
ALTER TABLE "DisbursementPolicy" ADD COLUMN "autoApproveCategories" JSONB;
ALTER TABLE "DisbursementPolicy" ADD COLUMN "autoApproveRiskLevels" JSONB;
ALTER TABLE "DisbursementPolicy" ADD COLUMN "requireReviewAbove" DECIMAL(12,2);

-- ============================================================
-- Document (1 col)
-- ============================================================
ALTER TABLE "Document" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- ============================================================
-- ExpenseRequest (5 cols, 1 orgId hazard)
-- ============================================================
ALTER TABLE "ExpenseRequest" ADD COLUMN "organizationId" TEXT NOT NULL;
ALTER TABLE "ExpenseRequest" ADD COLUMN "vendorName" TEXT;
ALTER TABLE "ExpenseRequest" ADD COLUMN "vendorEmail" TEXT;
ALTER TABLE "ExpenseRequest" ADD COLUMN "vendorPhone" TEXT;
ALTER TABLE "ExpenseRequest" ADD COLUMN "vendorWebsite" TEXT;

-- ============================================================
-- Grant (5 cols — MCC-level spending controls)
-- ============================================================
ALTER TABLE "Grant" ADD COLUMN "purpose" TEXT;
ALTER TABLE "Grant" ADD COLUMN "funderRequirements" JSONB;
ALTER TABLE "Grant" ADD COLUMN "approvedMCCs" JSONB;
ALTER TABLE "Grant" ADD COLUMN "blockedMCCs" JSONB;
ALTER TABLE "Grant" ADD COLUMN "whitelistedVendorIds" JSONB;

-- ============================================================
-- LedgerEntry (1 col, orgId hazard — scale-critical partition key)
-- ============================================================
ALTER TABLE "LedgerEntry" ADD COLUMN "organizationId" TEXT NOT NULL;

-- ============================================================
-- Subscription (1 col, orgId hazard)
-- ============================================================
ALTER TABLE "Subscription" ADD COLUMN "organizationId" TEXT NOT NULL;

-- ============================================================
-- Transaction (3 cols, 1 orgId hazard)
-- ============================================================
ALTER TABLE "Transaction" ADD COLUMN "organizationId" TEXT NOT NULL;
ALTER TABLE "Transaction" ADD COLUMN "grantId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "expenseId" TEXT;

-- ============================================================
-- Vendor (1 col — human-readable VN-xxxx-xxxxx code)
-- ============================================================
ALTER TABLE "Vendor" ADD COLUMN "vendorCode" TEXT;

-- ============================================================
-- VirtualCard (8 cols)
--   issuing_mode uses snake_case (@map("issuing_mode") in schema)
-- ============================================================
ALTER TABLE "VirtualCard" ADD COLUMN "grantId" TEXT;
ALTER TABLE "VirtualCard" ADD COLUMN "expenseId" TEXT;
ALTER TABLE "VirtualCard" ADD COLUMN "vendorId" TEXT;
ALTER TABLE "VirtualCard" ADD COLUMN "beneficiaryId" TEXT;
ALTER TABLE "VirtualCard" ADD COLUMN "issuing_mode" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "VirtualCard" ADD COLUMN "cardType" TEXT NOT NULL DEFAULT 'one_time';
ALTER TABLE "VirtualCard" ADD COLUMN "cardLabel" TEXT;
ALTER TABLE "VirtualCard" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- ============================================================
-- Indexes on new columns (10 non-unique)
-- ============================================================
CREATE INDEX "Approval_organizationId_idx" ON "Approval"("organizationId");
CREATE INDEX "BudgetCategory_organizationId_idx" ON "BudgetCategory"("organizationId");
CREATE INDEX "ExpenseRequest_organizationId_status_createdAt_idx" ON "ExpenseRequest"("organizationId", "status", "createdAt");
CREATE INDEX "ExpenseRequest_organizationId_riskClassification_idx" ON "ExpenseRequest"("organizationId", "riskClassification");
CREATE INDEX "LedgerEntry_organizationId_createdAt_idx" ON "LedgerEntry"("organizationId", "createdAt");
CREATE INDEX "Subscription_organizationId_idx" ON "Subscription"("organizationId");
CREATE INDEX "Transaction_organizationId_createdAt_idx" ON "Transaction"("organizationId", "createdAt");
CREATE INDEX "VirtualCard_grantId_idx" ON "VirtualCard"("grantId");
CREATE INDEX "VirtualCard_vendorId_idx" ON "VirtualCard"("vendorId");
CREATE INDEX "VirtualCard_beneficiaryId_idx" ON "VirtualCard"("beneficiaryId");

-- ============================================================
-- Unique indexes on new columns (2)
--   Vendor.vendorCode @unique
--   VirtualCard @@unique([expenseId])
-- ============================================================
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");
CREATE UNIQUE INDEX "VirtualCard_expenseId_key" ON "VirtualCard"("expenseId");

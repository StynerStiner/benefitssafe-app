-- ============================================================
-- BenefitsSafe Table Partitioning Migration
-- ============================================================
-- Run this AFTER the Prisma migration that adds organizationId
-- to ExpenseRequest and LedgerEntry.
--
-- Target: Aurora PostgreSQL 17.7
-- Strategy: Hash partitioning by organizationId
-- Partitions: 16 buckets (supports up to ~1M nonprofits)
--
-- Tables partitioned (no incoming FK references):
--   1. AuditLog        (HIGH: 500-2000/org/month)
--   2. Notification     (HIGH: 10-50/user/month)
--   3. Transaction      (HIGH: matches expenses 1:1)
--   4. WorkflowLog      (MEDIUM: automation logs)
--   5. GrantReport      (MEDIUM: weekly reports)
--   6. LedgerEntry      (HIGH: matches approved expenses)
--
-- Tables NOT partitioned (have incoming FK references):
--   User, Grant, ExpenseRequest, VirtualCard, Vendor,
--   Subscription, OrganizationMembership, Approval, etc.
--   These use composite indexes instead.
--
-- IMPORTANT: Run in a maintenance window. Each table migration
-- briefly locks the table during rename + data copy.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. AUDIT LOG (immutable, append-only, highest volume)
-- ============================================================

ALTER TABLE "AuditLog" RENAME TO "_AuditLog_old";

CREATE TABLE "AuditLog" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "action"         TEXT NOT NULL,
  "entityType"     TEXT NOT NULL,
  "entityId"       TEXT NOT NULL,
  "oldValue"       JSONB,
  "newValue"       JSONB,
  "ipAddress"      TEXT,
  "userAgent"      TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("id", "organizationId")
) PARTITION BY HASH ("organizationId");

-- Create 16 hash partitions
DO $$
BEGIN
  FOR i IN 0..15 LOOP
    EXECUTE format(
      'CREATE TABLE "AuditLog_p%s" PARTITION OF "AuditLog" FOR VALUES WITH (MODULUS 16, REMAINDER %s)',
      i, i
    );
  END LOOP;
END $$;

-- Migrate data
INSERT INTO "AuditLog" SELECT * FROM "_AuditLog_old";

-- Recreate indexes on partitioned table
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog" ("organizationId");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog" ("entityType", "entityId");
CREATE INDEX "AuditLog_userId_organizationId_idx" ON "AuditLog" ("userId", "organizationId");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog" ("organizationId", "createdAt");

DROP TABLE "_AuditLog_old";

-- ============================================================
-- 2. NOTIFICATION
-- ============================================================

ALTER TABLE "Notification" RENAME TO "_Notification_old";

CREATE TABLE "Notification" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type"           TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "message"        TEXT NOT NULL,
  "entityType"     TEXT,
  "entityId"       TEXT,
  "href"           TEXT,
  "read"           BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("id", "organizationId")
) PARTITION BY HASH ("organizationId");

DO $$
BEGIN
  FOR i IN 0..15 LOOP
    EXECUTE format(
      'CREATE TABLE "Notification_p%s" PARTITION OF "Notification" FOR VALUES WITH (MODULUS 16, REMAINDER %s)',
      i, i
    );
  END LOOP;
END $$;

INSERT INTO "Notification" SELECT * FROM "_Notification_old";

CREATE INDEX "Notification_userId_read_idx" ON "Notification" ("userId", "read");
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification" ("organizationId", "createdAt");

DROP TABLE "_Notification_old";

-- ============================================================
-- 3. TRANSACTION
-- ============================================================

ALTER TABLE "Transaction" RENAME TO "_Transaction_old";

CREATE TABLE "Transaction" (
  "id"                  TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "cardId"              TEXT NOT NULL,
  "stripeTransactionId" TEXT NOT NULL,
  "amount"              DECIMAL(10,2) NOT NULL,
  "merchantName"        TEXT NOT NULL,
  "merchantCategory"    TEXT,
  "status"              TEXT NOT NULL,
  "declinedReason"      TEXT,
  "grantId"             TEXT,
  "expenseId"           TEXT,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("id", "organizationId")
) PARTITION BY HASH ("organizationId");

DO $$
BEGIN
  FOR i IN 0..15 LOOP
    EXECUTE format(
      'CREATE TABLE "Transaction_p%s" PARTITION OF "Transaction" FOR VALUES WITH (MODULUS 16, REMAINDER %s)',
      i, i
    );
  END LOOP;
END $$;

INSERT INTO "Transaction" SELECT * FROM "_Transaction_old";

-- stripeTransactionId uniqueness is per-partition only (PG constraint)
-- CUIDs + Stripe IDs ensure practical global uniqueness
CREATE UNIQUE INDEX "Transaction_stripeTransactionId_key" ON "Transaction" ("stripeTransactionId", "organizationId");
CREATE INDEX "Transaction_cardId_idx" ON "Transaction" ("cardId");
CREATE INDEX "Transaction_organizationId_idx" ON "Transaction" ("organizationId");
CREATE INDEX "Transaction_cardId_createdAt_idx" ON "Transaction" ("cardId", "createdAt");
CREATE INDEX "Transaction_organizationId_createdAt_idx" ON "Transaction" ("organizationId", "createdAt");

DROP TABLE "_Transaction_old";

-- ============================================================
-- 4. WORKFLOW LOG
-- ============================================================

ALTER TABLE "WorkflowLog" RENAME TO "_WorkflowLog_old";

CREATE TABLE "WorkflowLog" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "triggerId"       TEXT NOT NULL,
  "eventType"       TEXT NOT NULL,
  "provider"        TEXT NOT NULL,
  "actionSlug"      TEXT NOT NULL,
  "status"          TEXT NOT NULL,
  "requestPayload"  JSONB,
  "responsePayload" JSONB,
  "errorMessage"    TEXT,
  "executionTimeMs" INTEGER,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("id", "organizationId")
) PARTITION BY HASH ("organizationId");

DO $$
BEGIN
  FOR i IN 0..15 LOOP
    EXECUTE format(
      'CREATE TABLE "WorkflowLog_p%s" PARTITION OF "WorkflowLog" FOR VALUES WITH (MODULUS 16, REMAINDER %s)',
      i, i
    );
  END LOOP;
END $$;

INSERT INTO "WorkflowLog" SELECT * FROM "_WorkflowLog_old";

CREATE INDEX "WorkflowLog_organizationId_createdAt_idx" ON "WorkflowLog" ("organizationId", "createdAt");
CREATE INDEX "WorkflowLog_triggerId_idx" ON "WorkflowLog" ("triggerId");

DROP TABLE "_WorkflowLog_old";

-- ============================================================
-- 5. GRANT REPORT
-- ============================================================

ALTER TABLE "GrantReport" RENAME TO "_GrantReport_old";

CREATE TABLE "GrantReport" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "grantId"        TEXT NOT NULL,
  "reportType"     TEXT NOT NULL DEFAULT 'weekly_disbursement',
  "reportData"     JSONB NOT NULL,
  "periodStart"    TIMESTAMPTZ NOT NULL,
  "periodEnd"      TIMESTAMPTZ NOT NULL,
  "generatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "generatedBy"    TEXT NOT NULL DEFAULT 'sentinellayer_reporter',
  "status"         TEXT NOT NULL DEFAULT 'draft',
  PRIMARY KEY ("id", "organizationId")
) PARTITION BY HASH ("organizationId");

DO $$
BEGIN
  FOR i IN 0..15 LOOP
    EXECUTE format(
      'CREATE TABLE "GrantReport_p%s" PARTITION OF "GrantReport" FOR VALUES WITH (MODULUS 16, REMAINDER %s)',
      i, i
    );
  END LOOP;
END $$;

INSERT INTO "GrantReport" SELECT * FROM "_GrantReport_old";

CREATE INDEX "GrantReport_organizationId_grantId_idx" ON "GrantReport" ("organizationId", "grantId");
CREATE INDEX "GrantReport_organizationId_generatedAt_idx" ON "GrantReport" ("organizationId", "generatedAt");

DROP TABLE "_GrantReport_old";

-- ============================================================
-- 6. LEDGER ENTRY (after organizationId column exists)
-- ============================================================
-- NOTE: Run this ONLY after the Prisma migration that adds
-- organizationId to LedgerEntry and backfills it from Grant.
-- ============================================================

-- First, backfill organizationId from the related Grant
UPDATE "LedgerEntry" le
SET "organizationId" = g."organizationId"
FROM "Grant" g
WHERE le."grantId" = g."id"
  AND (le."organizationId" IS NULL OR le."organizationId" = '');

-- Now partition
ALTER TABLE "LedgerEntry" RENAME TO "_LedgerEntry_old";

CREATE TABLE "LedgerEntry" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "grantId"        TEXT NOT NULL,
  "categoryId"     TEXT,
  "expenseId"      TEXT,
  "type"           TEXT NOT NULL,
  "amount"         DECIMAL(12,2) NOT NULL,
  "balanceAfter"   DECIMAL(12,2) NOT NULL,
  "description"    TEXT NOT NULL,
  "reference"      TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("id", "organizationId")
) PARTITION BY HASH ("organizationId");

DO $$
BEGIN
  FOR i IN 0..15 LOOP
    EXECUTE format(
      'CREATE TABLE "LedgerEntry_p%s" PARTITION OF "LedgerEntry" FOR VALUES WITH (MODULUS 16, REMAINDER %s)',
      i, i
    );
  END LOOP;
END $$;

INSERT INTO "LedgerEntry" SELECT * FROM "_LedgerEntry_old";

CREATE INDEX "LedgerEntry_organizationId_idx" ON "LedgerEntry" ("organizationId");
CREATE INDEX "LedgerEntry_organizationId_createdAt_idx" ON "LedgerEntry" ("organizationId", "createdAt");
CREATE INDEX "LedgerEntry_grantId_idx" ON "LedgerEntry" ("grantId");
CREATE INDEX "LedgerEntry_expenseId_idx" ON "LedgerEntry" ("expenseId");
CREATE INDEX "LedgerEntry_grantId_createdAt_idx" ON "LedgerEntry" ("grantId", "createdAt");

DROP TABLE "_LedgerEntry_old";

COMMIT;

-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================
-- SELECT schemaname, tablename FROM pg_tables
--   WHERE tablename LIKE '%_p%' ORDER BY tablename;
--
-- SELECT tableoid::regclass, count(*)
--   FROM "AuditLog" GROUP BY tableoid ORDER BY tableoid;
--
-- EXPLAIN SELECT * FROM "AuditLog"
--   WHERE "organizationId" = 'test_org_id';
-- (Should show "Seq Scan on AuditLog_pN" — single partition)

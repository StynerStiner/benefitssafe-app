-- ============================================================
-- BenefitsSafe Table Partitioning Migration (FIXED v2)
-- ============================================================
-- Fix: Drop _old table BEFORE creating indexes (name collision),
-- TIMESTAMP not TIMESTAMPTZ, correct column order, LedgerType enum,
-- ADD organizationId to LedgerEntry before partitioning.
-- ============================================================

BEGIN;

-- ============================================================
-- 0. ADD organizationId TO LedgerEntry (does not exist yet)
-- ============================================================
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "LedgerEntry" le
SET "organizationId" = g."organizationId"
FROM "Grant" g
WHERE le."grantId" = g."id"
  AND (le."organizationId" IS NULL OR le."organizationId" = '');

ALTER TABLE "LedgerEntry" ALTER COLUMN "organizationId" SET NOT NULL;

-- ============================================================
-- 1. AUDIT LOG
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
  "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
  "userAgent"      TEXT,
  PRIMARY KEY ("id", "organizationId")
) PARTITION BY HASH ("organizationId");

DO $$
BEGIN
  FOR i IN 0..15 LOOP
    EXECUTE format(
      'CREATE TABLE "AuditLog_p%s" PARTITION OF "AuditLog" FOR VALUES WITH (MODULUS 16, REMAINDER %s)',
      i, i
    );
  END LOOP;
END $$;

INSERT INTO "AuditLog" SELECT * FROM "_AuditLog_old";
DROP TABLE "_AuditLog_old" CASCADE;

CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog" ("organizationId");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog" ("entityType", "entityId");
CREATE INDEX "AuditLog_userId_organizationId_idx" ON "AuditLog" ("userId", "organizationId");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog" ("organizationId", "createdAt");

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
  "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
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
DROP TABLE "_Notification_old" CASCADE;

CREATE INDEX "Notification_userId_read_idx" ON "Notification" ("userId", "read");
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification" ("organizationId", "createdAt");

-- ============================================================
-- 3. TRANSACTION
-- ============================================================
ALTER TABLE "Transaction" RENAME TO "_Transaction_old";

CREATE TABLE "Transaction" (
  "id"                  TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "cardId"              TEXT NOT NULL,
  "stripeTransactionId" TEXT NOT NULL,
  "amount"              NUMERIC NOT NULL,
  "merchantName"        TEXT NOT NULL,
  "merchantCategory"    TEXT,
  "status"              TEXT NOT NULL,
  "declinedReason"      TEXT,
  "grantId"             TEXT,
  "expenseId"           TEXT,
  "createdAt"           TIMESTAMP NOT NULL DEFAULT now(),
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
DROP TABLE "_Transaction_old" CASCADE;

CREATE UNIQUE INDEX "Transaction_stripeTransactionId_key" ON "Transaction" ("stripeTransactionId", "organizationId");
CREATE INDEX "Transaction_cardId_idx" ON "Transaction" ("cardId");
CREATE INDEX "Transaction_organizationId_idx" ON "Transaction" ("organizationId");
CREATE INDEX "Transaction_cardId_createdAt_idx" ON "Transaction" ("cardId", "createdAt");
CREATE INDEX "Transaction_organizationId_createdAt_idx" ON "Transaction" ("organizationId", "createdAt");

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
  "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
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
DROP TABLE "_WorkflowLog_old" CASCADE;

CREATE INDEX "WorkflowLog_organizationId_createdAt_idx" ON "WorkflowLog" ("organizationId", "createdAt");
CREATE INDEX "WorkflowLog_triggerId_idx" ON "WorkflowLog" ("triggerId");

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
  "periodStart"    TIMESTAMP NOT NULL,
  "periodEnd"      TIMESTAMP NOT NULL,
  "generatedAt"    TIMESTAMP NOT NULL DEFAULT now(),
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
DROP TABLE "_GrantReport_old" CASCADE;

CREATE INDEX "GrantReport_organizationId_grantId_idx" ON "GrantReport" ("organizationId", "grantId");
CREATE INDEX "GrantReport_organizationId_generatedAt_idx" ON "GrantReport" ("organizationId", "generatedAt");

-- ============================================================
-- 6. LEDGER ENTRY
-- ============================================================
-- organizationId was added in step 0 via ALTER TABLE, so it's the last column
ALTER TABLE "LedgerEntry" RENAME TO "_LedgerEntry_old";

CREATE TABLE "LedgerEntry" (
  "id"             TEXT NOT NULL,
  "grantId"        TEXT NOT NULL,
  "categoryId"     TEXT,
  "expenseId"      TEXT,
  "type"           "LedgerType" NOT NULL,
  "amount"         NUMERIC NOT NULL,
  "balanceAfter"   NUMERIC NOT NULL,
  "description"    TEXT NOT NULL,
  "reference"      TEXT,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT NOT NULL,
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
DROP TABLE "_LedgerEntry_old" CASCADE;

CREATE INDEX "LedgerEntry_organizationId_idx" ON "LedgerEntry" ("organizationId");
CREATE INDEX "LedgerEntry_organizationId_createdAt_idx" ON "LedgerEntry" ("organizationId", "createdAt");
CREATE INDEX "LedgerEntry_grantId_idx" ON "LedgerEntry" ("grantId");
CREATE INDEX "LedgerEntry_expenseId_idx" ON "LedgerEntry" ("expenseId");
CREATE INDEX "LedgerEntry_grantId_createdAt_idx" ON "LedgerEntry" ("grantId", "createdAt");

COMMIT;

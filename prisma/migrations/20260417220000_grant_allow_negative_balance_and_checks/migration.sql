-- DDIA Ch7 P4 (Approach B): allow negative balance only when
-- explicitly flagged. See docs/design-notes/ddia-ch07-transactions-applied.md

ALTER TABLE "Grant"
  ADD COLUMN "allowNegativeBalance" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Grant"
  ADD CONSTRAINT "Grant_totalAmount_non_negative_check"
  CHECK ("totalAmount" >= 0);

ALTER TABLE "Grant"
  ADD CONSTRAINT "Grant_spentAmount_non_negative_check"
  CHECK ("spentAmount" >= 0);

ALTER TABLE "Grant"
  ADD CONSTRAINT "Grant_remainingAmount_non_negative_check"
  CHECK ("remainingAmount" >= 0 OR "allowNegativeBalance" = true);

-- DDIA Ch7 P5: partial unique index that the side script at
-- scripts/add-virtual-card-unique-constraints.ts defines but
-- never applied to Aurora. Non-concurrent because Prisma migrate
-- runs in a transaction; brief lock on a small VirtualCard table
-- is acceptable on this pre-revenue DB. Side script uses
-- CONCURRENTLY for future hot-production re-runs; this statement
-- is idempotent (IF NOT EXISTS).
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_active_card_per_grant_beneficiary"
  ON "VirtualCard" ("grantId", "beneficiaryId")
  WHERE status = 'ACTIVE';

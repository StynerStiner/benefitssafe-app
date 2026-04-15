// DDIA Ch7 Transaction Safety audit — VirtualCard unique constraints.
//
// Without these, double-click-to-issue races and retried POSTs against
// /api/expenses/[id]/issue-card or /api/grants/[id]/issue-card can
// create two VirtualCard rows for the same expense or the same
// (grant, beneficiary). The application-layer existence checks and the
// Stripe idempotency keys added alongside this migration fix most of
// the fence cases but the only *correctness* guarantee is the DB-level
// unique constraint.
//
// Two constraints applied here:
//
//   1. uniq_active_card_per_expense — one card per ExpenseRequest.
//      Mirrors @@unique([expenseId]) on prisma/schema.prisma. Nullable
//      column, so Postgres allows multiple NULLs (i.e. direct-grant
//      cards without an expenseId are not affected). This is the
//      Prisma-default-named unique index that `prisma db push` would
//      create; we apply it manually so schema + live DB stay aligned
//      without running push against production.
//
//   2. uniq_active_card_per_grant_beneficiary — partial unique index on
//      (grantId, beneficiaryId) WHERE status = 'ACTIVE'. Prisma's schema
//      language can't express partial unique indexes, so this one lives
//      entirely here. Enforces: at most one ACTIVE card per beneficiary
//      per grant. Cancelled/frozen cards are unaffected, so a
//      beneficiary who had a card closed can still be issued a fresh one.
//
// Both use CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS so they are
// safe to apply on a hot production DB and idempotent on re-run.
// IF EXISTS means this script can be re-run in the future without
// failing.
//
// Usage:
//   cd benefits-safe-app
//   vercel env pull .env.prod.migration --environment=production --yes
//   npx tsx --env-file=.env.prod.migration scripts/add-virtual-card-unique-constraints.ts
//   rm .env.prod.migration

import { prisma } from "../lib/db";

interface IndexRow {
  indexname: string;
  indexdef: string;
}

async function dumpIndexes(label: string): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<IndexRow[]>(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'VirtualCard'
    ORDER BY indexname;
  `);
  console.log(`\n=== ${label} (VirtualCard indexes) ===`);
  for (const row of rows) {
    console.log(`  ${row.indexname}`);
    console.log(`    ${row.indexdef}`);
  }
}

async function runDdl(label: string, sql: string): Promise<void> {
  console.log(`\n${label}`);
  console.log(`  ${sql.replace(/\s+/g, " ").trim()}`);
  const start = Date.now();
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ done in ${Math.round((Date.now() - start) / 1000)}s`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ FAILED: ${message}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log("BenefitsSafe — DDIA Ch7 VirtualCard unique constraints migration");
  console.log("-----------------------------------------------------------------");

  await dumpIndexes("BEFORE");

  // 1. Unique on expenseId (mirrors Prisma @@unique([expenseId])).
  //    Prisma's default name for this is `VirtualCard_expenseId_key`.
  await runDdl(
    "CREATE unique on expenseId",
    `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "VirtualCard_expenseId_key"
       ON "VirtualCard" ("expenseId")`,
  );

  // 2. Partial unique on (grantId, beneficiaryId) WHERE status='ACTIVE'.
  //    Allows multiple CANCELLED/EXPIRED/FROZEN cards, at most one ACTIVE.
  await runDdl(
    "CREATE partial unique on (grantId, beneficiaryId) WHERE status='ACTIVE'",
    `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "uniq_active_card_per_grant_beneficiary"
       ON "VirtualCard" ("grantId", "beneficiaryId")
       WHERE status = 'ACTIVE'`,
  );

  await dumpIndexes("AFTER");

  console.log(
    "\nDone. Verify: VirtualCard_expenseId_key and uniq_active_card_per_grant_beneficiary should both be listed above.",
  );
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

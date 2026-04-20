// DDIA Ch9 Consistency & Consensus — add LedgerEntry.seq (BIGSERIAL)
// + (organizationId, seq) index.
//
// Context:
//   LedgerEntry.createdAt has millisecond precision. Two expense-approval
//   `$transaction`s committing in the same tick produce rows with
//   identical `createdAt`, making ORDER BY createdAt non-deterministic
//   for same-ms entries. At 1.8M-org scale with concurrent approvals,
//   audit-trail reproducibility breaks.
//
//   The cure is a DB-generated monotonic sequence:
//     seq BIGSERIAL — strictly monotonic, gap-free, immune to clock
//     drift and concurrency. Use `seq` for ordering; keep `createdAt`
//     for human-readable display.
//
//   Mirrors scripts/add-transaction-dispute-event-ordering.ts and
//   scripts/add-organization-account-event-ordering.ts in shape
//   (standalone script, IF NOT EXISTS, idempotent).
//
// Safety properties:
//   - ADD COLUMN BIGSERIAL backfills every existing row with sequential
//     values during the statement. At launch scale this is instant; on
//     a large table this is a full rewrite — acceptable at our scale.
//   - CREATE INDEX CONCURRENTLY avoids locking the table during index
//     build. Must run outside a transaction — Prisma `$executeRawUnsafe`
//     uses autocommit by default, so this is safe.
//   - IF NOT EXISTS on both steps — idempotent.
//
// Usage (from benefits-safe-app/):
//
//   vercel env pull .env.prod.migration --environment=production --yes
//   npx tsx --env-file=.env.prod.migration scripts/add-ledger-entry-sequence.ts
//   rm .env.prod.migration

import { prisma } from "../lib/db";

async function main() {
  console.log("=== Ch9 P2: adding LedgerEntry.seq + (organizationId, seq) index ===");

  const colBefore = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'LedgerEntry' AND column_name = 'seq'`,
  );
  if (colBefore.length > 0) {
    console.log("— LedgerEntry.seq already present.");
  } else {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "seq" BIGSERIAL`,
    );
    const colAfter = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'LedgerEntry' AND column_name = 'seq'`,
    );
    if (colAfter.length !== 1) {
      throw new Error("LedgerEntry.seq did not land — check Aurora logs.");
    }
    console.log("✓ LedgerEntry.seq added (existing rows backfilled).");
  }

  const idxBefore = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
    `SELECT indexname FROM pg_indexes
     WHERE tablename = 'LedgerEntry'
       AND indexname = 'LedgerEntry_organizationId_seq_idx'`,
  );
  if (idxBefore.length > 0) {
    console.log("— LedgerEntry_organizationId_seq_idx already present.");
  } else {
    // CONCURRENTLY must not be inside a transaction. Prisma's
    // $executeRawUnsafe runs each statement in autocommit mode.
    await prisma.$executeRawUnsafe(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "LedgerEntry_organizationId_seq_idx" ON "LedgerEntry" ("organizationId", "seq")`,
    );
    const idxAfter = await prisma.$queryRawUnsafe<Array<{ indexname: string; indisvalid: boolean }>>(
      `SELECT i.relname AS indexname, ix.indisvalid
       FROM pg_class t
       JOIN pg_index ix ON t.oid = ix.indrelid
       JOIN pg_class i ON i.oid = ix.indexrelid
       WHERE t.relname = 'LedgerEntry'
         AND i.relname = 'LedgerEntry_organizationId_seq_idx'`,
    );
    if (idxAfter.length !== 1) {
      throw new Error("LedgerEntry_organizationId_seq_idx did not land — check Aurora logs.");
    }
    if (!idxAfter[0]?.indisvalid) {
      throw new Error(
        "LedgerEntry_organizationId_seq_idx is INVALID (CONCURRENTLY build failed). " +
          "DROP INDEX and re-run this script.",
      );
    }
    console.log("✓ LedgerEntry_organizationId_seq_idx built (CONCURRENTLY, indisvalid=true).");
  }

  console.log("✓ All migration steps verified.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

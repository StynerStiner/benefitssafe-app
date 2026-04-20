// DDIA Ch12 F1 — end-to-end request ID for expense creation dedup.
//
// Context:
//   Expense create was the last money-moving path without durable
//   request-ID dedup. A client retry (network timeout, double-click,
//   browser refresh on POST) produced a duplicate ExpenseRequest and
//   a duplicate downstream ledger entry on approval. At 1.8M-org
//   scale this is a real money-integrity gap. Same shape as
//   FundTransfer.requestId (@@unique([organizationId, requestId]) +
//   P2002-catch-returns-existing pattern).
//
// Two steps:
//   1. ALTER TABLE "ExpenseRequest" ADD COLUMN IF NOT EXISTS "requestId" TEXT
//      — nullable for backward compatibility. Older clients that don't
//      send a requestId continue to work.
//   2. CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS with a PARTIAL
//      clause (WHERE "requestId" IS NOT NULL) so two rows with NULL
//      requestId never collide. Postgres already treats NULL as
//      distinct in regular UNIQUE indexes; the partial form makes the
//      intent explicit and keeps the index smaller (only indexes rows
//      that opted into idempotency).
//
// Safety properties:
//   - ADD COLUMN nullable — metadata-only on Postgres, no table rewrite.
//   - CREATE UNIQUE INDEX CONCURRENTLY — no exclusive lock during build;
//     must run outside a transaction, which Prisma `$executeRawUnsafe`
//     does by default.
//   - IF NOT EXISTS on both steps — idempotent.
//   - Verifies indisvalid after CONCURRENTLY build; throws if the index
//     landed as INVALID so the operator can DROP + retry.
//
// Note on Prisma schema drift:
//   prisma/schema.prisma declares `@@unique([organizationId, requestId])`
//   for Prisma client type support (findUnique, upsert). The DB-level
//   index created here is a *partial* unique index — functionally
//   equivalent for our use case (Postgres treats NULL as distinct in
//   both forms) but smaller. This codebase does not use `prisma
//   migrate` for production; schema annotation and DB state match
//   semantically even if not byte-for-byte.
//
// Usage (from benefits-safe-app/):
//
//   vercel env pull .env.prod.migration --environment=production --yes
//   npx tsx --env-file=.env.prod.migration scripts/add-expense-request-id.ts
//   rm .env.prod.migration

import { prisma } from "../lib/db";

async function main() {
  console.log("=== Ch12 F1: adding ExpenseRequest.requestId + partial unique index ===");

  const colBefore = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'ExpenseRequest' AND column_name = 'requestId'`,
  );
  if (colBefore.length > 0) {
    console.log("— ExpenseRequest.requestId already present.");
  } else {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ExpenseRequest" ADD COLUMN IF NOT EXISTS "requestId" TEXT`,
    );
    const colAfter = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'ExpenseRequest' AND column_name = 'requestId'`,
    );
    if (colAfter.length !== 1) {
      throw new Error("ExpenseRequest.requestId did not land — check Aurora logs.");
    }
    console.log("✓ ExpenseRequest.requestId added.");
  }

  const idxBefore = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
    `SELECT indexname FROM pg_indexes
     WHERE tablename = 'ExpenseRequest'
       AND indexname = 'ExpenseRequest_organizationId_requestId_key'`,
  );
  if (idxBefore.length > 0) {
    console.log("— ExpenseRequest_organizationId_requestId_key already present.");
  } else {
    // CONCURRENTLY must not be inside a transaction; Prisma's
    // $executeRawUnsafe runs each statement in autocommit mode.
    // Partial unique — only indexes rows with requestId set.
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "ExpenseRequest_organizationId_requestId_key" ON "ExpenseRequest" ("organizationId", "requestId") WHERE "requestId" IS NOT NULL`,
    );
    const idxAfter = await prisma.$queryRawUnsafe<Array<{ indexname: string; indisvalid: boolean; indisunique: boolean }>>(
      `SELECT i.relname AS indexname, ix.indisvalid, ix.indisunique
       FROM pg_class t
       JOIN pg_index ix ON t.oid = ix.indrelid
       JOIN pg_class i ON i.oid = ix.indexrelid
       WHERE t.relname = 'ExpenseRequest'
         AND i.relname = 'ExpenseRequest_organizationId_requestId_key'`,
    );
    if (idxAfter.length !== 1) {
      throw new Error("ExpenseRequest_organizationId_requestId_key did not land — check Aurora logs.");
    }
    if (!idxAfter[0]?.indisvalid) {
      throw new Error(
        "ExpenseRequest_organizationId_requestId_key is INVALID (CONCURRENTLY build failed). " +
          "DROP INDEX and re-run this script.",
      );
    }
    if (!idxAfter[0]?.indisunique) {
      throw new Error(
        "ExpenseRequest_organizationId_requestId_key exists but is NOT UNIQUE. " +
          "DROP INDEX and re-run this script.",
      );
    }
    console.log("✓ ExpenseRequest_organizationId_requestId_key built (CONCURRENTLY, indisvalid+indisunique=true, partial WHERE requestId IS NOT NULL).");
  }

  console.log("✓ All migration steps verified.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

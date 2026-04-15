// DDIA Ch11 Stream Processing audit follow-up — add Document.archivedAt.
//
// Context:
//   The new admin CCPA deletion route (/api/admin/data-deletion) needs
//   to soft-delete every document uploaded by a user whose PII is being
//   scrubbed. Hard deletion would lose the audit fact that the document
//   ever existed; soft deletion keeps the row for compliance continuity
//   and just hides it from active queries.
//
// This script adds a nullable archivedAt column to the Document table.
//
// Safety properties:
//   - ADD COLUMN nullable — metadata-only on Postgres, no table rewrite,
//     no lock contention at production scale.
//   - IF NOT EXISTS — idempotent, re-runnable.
//
// Usage (from benefits-safe-app/):
//
//   vercel env pull .env.prod.migration --environment=production --yes
//   npx tsx --env-file=.env.prod.migration scripts/add-document-archived-at.ts
//   rm .env.prod.migration

import { prisma } from "../lib/db";

async function main() {
  console.log("=== Ch11 follow-up: adding Document.archivedAt ===");

  const before = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'Document' AND column_name = 'archivedAt'`,
  );
  if (before.length > 0) {
    console.log("Column already present — nothing to do.");
    return;
  }

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`,
  );

  const after = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'Document' AND column_name = 'archivedAt'`,
  );
  if (after.length !== 1) {
    throw new Error("Column did not land — check Aurora logs.");
  }
  console.log("✓ Document.archivedAt added.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

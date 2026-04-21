// Nygard Ch 18 p.319 — add _schema_version table + seed row.
//
// Context:
//   Before this script, the app had no runtime signal that its code
//   matched the DB schema it was pointed at. A deploy that shipped
//   ahead of its migration would start silently and only fail later
//   with obscure "column does not exist" errors from Prisma. Fail Fast
//   (Nygard Ch 18) says the app should refuse to treat an unknown
//   schema as healthy — check at startup and surface the mismatch.
//
//   This script creates _schema_version (single-row, id=1) and seeds
//   it with the current version. lib/schema-version.ts holds the
//   expected version; /api/health compares the two and reports drift.
//
// Migration script template (for future schema changes):
//   1. Run your DDL here (ADD COLUMN / CREATE INDEX / etc.)
//   2. Bump EXPECTED_SCHEMA_VERSION in lib/schema-version.ts
//   3. UPDATE _schema_version SET version = <new>, appliedAt = now()
//      WHERE id = 1;
//
// Safety properties:
//   - CREATE TABLE IF NOT EXISTS — idempotent.
//   - INSERT ... ON CONFLICT DO NOTHING — safe to re-run.
//   - Single-row enforced by id INTEGER PRIMARY KEY DEFAULT 1; any
//     second insert with default id collides with the PK and fails,
//     matching the Prisma `@id @default(1)` semantics.
//
// Usage (from benefits-safe-app/):
//
//   vercel env pull .env.prod.migration --environment=production --yes
//   npx tsx --env-file=.env.prod.migration scripts/add-schema-version.ts
//   rm .env.prod.migration

import { prisma } from "../lib/db";
import { EXPECTED_SCHEMA_VERSION } from "../lib/schema-version";

async function main() {
  console.log("=== Ch18: creating _schema_version table ===");

  const tableBefore = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_name = '_schema_version'`,
  );
  if (tableBefore.length > 0) {
    console.log("— _schema_version already present.");
  } else {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "_schema_version" (
         "id" INTEGER PRIMARY KEY DEFAULT 1,
         "version" INTEGER NOT NULL,
         "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`,
    );
    const tableAfter = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_name = '_schema_version'`,
    );
    if (tableAfter.length !== 1) {
      throw new Error("_schema_version did not land — check Aurora logs.");
    }
    console.log("✓ _schema_version table created.");
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "_schema_version" ("id", "version", "appliedAt")
     VALUES (1, $1, CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE
       SET "version" = EXCLUDED."version",
           "appliedAt" = EXCLUDED."appliedAt"`,
    EXPECTED_SCHEMA_VERSION,
  );

  const row = await prisma.$queryRawUnsafe<Array<{ version: number }>>(
    `SELECT "version" FROM "_schema_version" WHERE "id" = 1`,
  );
  if (row.length !== 1 || row[0]?.version !== EXPECTED_SCHEMA_VERSION) {
    throw new Error(
      `_schema_version row mismatch: got ${JSON.stringify(row)}, expected version=${EXPECTED_SCHEMA_VERSION}`,
    );
  }
  console.log(`✓ _schema_version row set to version=${EXPECTED_SCHEMA_VERSION}.`);
  console.log("✓ All migration steps verified.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

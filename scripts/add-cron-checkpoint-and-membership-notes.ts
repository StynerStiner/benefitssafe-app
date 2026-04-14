// Two structural schema additions, applied via raw SQL so we never touch
// `prisma migrate dev` on a hot prod database:
//
//   1. CronCheckpoint table — lets dispatcher crons resume from where the
//      last run left off, instead of scanning the Organization table from
//      the beginning every tick. At 1.8M nonprofits this is the difference
//      between draining the table in 1 cron firing (impossible — Lambda
//      timeout) and draining it gradually across many firings.
//
//   2. OrganizationMembership.notes column — per-org private notes about a
//      member. The legacy User.notes field stays for backward compat but
//      is shared across every nonprofit a person belongs to; new writes go
//      to OrganizationMembership.notes so each nonprofit has isolation.

import { prisma } from "../lib/db";

async function main() {
  console.log("Creating CronCheckpoint table…");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CronCheckpoint" (
      "id" TEXT PRIMARY KEY,
      "cronName" TEXT NOT NULL UNIQUE,
      "lastCursor" TEXT,
      "lastRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "processedCount" INTEGER NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CronCheckpoint_cronName_idx"
    ON "CronCheckpoint" ("cronName");
  `);

  console.log("Adding OrganizationMembership.notes column…");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "OrganizationMembership"
    ADD COLUMN IF NOT EXISTS "notes" TEXT;
  `);

  // Verify
  const cronCols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'CronCheckpoint' ORDER BY column_name;
  `);
  console.log("CronCheckpoint columns:", cronCols.map((c) => c.column_name));

  const memCols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'OrganizationMembership' AND column_name = 'notes';
  `);
  console.log("OrganizationMembership.notes present:", memCols.length === 1);
}

main().finally(() => prisma.$disconnect());

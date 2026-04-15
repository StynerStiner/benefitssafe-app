// One-shot: add User.alertPreferences JSONB column.
//
// Stores each user's notification preferences (mail/sms/push channels,
// toggles, optional custom messages). The /alert-preferences page reads
// and writes this directly via its server action. Shape is intentionally
// flexible — whatever the form submits is persisted verbatim so the UX
// can evolve without another migration.
//
// Safe to re-run: ADD COLUMN IF NOT EXISTS.

import { prisma } from "../lib/db";

async function main() {
  console.log("Adding User.alert_preferences column...");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "alert_preferences" JSONB;
  `);

  console.log("Done. Verifying...");
  const rows = await prisma.$queryRawUnsafe<
    Array<{ column_name: string; data_type: string }>
  >(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'User'
      AND column_name = 'alert_preferences';
  `);
  console.table(rows);
}

main().finally(() => prisma.$disconnect());

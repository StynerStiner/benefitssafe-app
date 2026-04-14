// One-shot: add VirtualCard.issuing_mode column.
//
// "platform" means the card lives on acct_1THZmv1lmD1ohIWk (the
// BenefitsSafe platform Stripe account) and draws from the platform
// Treasury Financial Account. "connected" means it lives on the
// nonprofit's own Stripe Custom account and draws from their own
// Treasury FA.
//
// Default 'platform' is correct for both (a) any pre-existing rows,
// which were issued before the multi-tenant migration and all live on
// the platform, and (b) all newly issued cards for tenants whose
// connected account hasn't been granted card_issuing yet.
//
// Safe to re-run: ADD COLUMN IF NOT EXISTS.

import { prisma } from "../lib/db";

async function main() {
  console.log("Adding VirtualCard.issuing_mode column...");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "VirtualCard"
    ADD COLUMN IF NOT EXISTS "issuing_mode" TEXT NOT NULL DEFAULT 'platform';
  `);

  console.log("Done. Verifying...");

  const rows = await prisma.$queryRawUnsafe<
    Array<{ column_name: string; data_type: string; column_default: string | null }>
  >(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'VirtualCard'
      AND column_name = 'issuing_mode';
  `);
  console.table(rows);

  // Show distribution of existing rows
  const distribution = await prisma.$queryRawUnsafe<
    Array<{ issuing_mode: string; count: bigint }>
  >(`
    SELECT issuing_mode, COUNT(*) AS count
    FROM "VirtualCard"
    GROUP BY issuing_mode
    ORDER BY issuing_mode;
  `);
  console.log("Existing row distribution:");
  console.table(
    distribution.map((r) => ({ ...r, count: Number(r.count) })),
  );
}

main().finally(() => prisma.$disconnect());

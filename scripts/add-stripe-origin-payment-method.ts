// One-shot: add Organization.stripeOriginPaymentMethodId column.
//
// Stores the connected-account PaymentMethod id that the nonprofit's
// external bank was linked to via Stripe Elements. The /api/org/fund
// route uses this id as `origin_payment_method` when creating a
// Treasury inbound transfer.
//
// Safe to re-run: uses IF NOT EXISTS.

import { prisma } from "../lib/db";

async function main() {
  console.log("Adding Organization.stripeOriginPaymentMethodId column...");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Organization"
    ADD COLUMN IF NOT EXISTS "stripeOriginPaymentMethodId" TEXT;
  `);

  console.log("Done. Verifying...");

  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string }>>(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'Organization'
      AND column_name = 'stripeOriginPaymentMethodId';
  `);
  console.table(rows);
}

main().finally(() => prisma.$disconnect());

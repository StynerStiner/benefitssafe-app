// DDIA Ch9 Consistency & Consensus — add BillingSubscription.lastBillingEventAt.
//
// Context:
//   Stripe Billing webhooks are at-least-once and not strictly ordered.
//   The Ch9 audit found that a late `invoice.payment_failed` retry could
//   arrive after `invoice.payment_succeeded` and overwrite the newer
//   status back to `past_due`. Same shape applies to subscription.*
//   events on tier/status flips. The fix adds an `eventAt` high-water
//   mark (from Stripe's `event.created`, not our server clock) and
//   guards every UPDATE with
//     WHERE lastBillingEventAt IS NULL OR lastBillingEventAt < :eventAt
//   so a stale retry becomes a logged no-op.
//
// This script adds the nullable column (existing rows stay NULL — the
// WHERE clause treats NULL as "unknown / always allow" to preserve
// current behavior on first event after deploy).
//
// Safety properties:
//   - ADD COLUMN nullable — metadata-only on Postgres, no table rewrite,
//     no lock contention at production scale. Fast.
//   - IF NOT EXISTS — idempotent.
//
// Usage (from benefits-safe-app/):
//
//   vercel env pull .env.prod.migration --environment=production --yes
//   npx tsx --env-file=.env.prod.migration scripts/add-billing-subscription-event-ordering.ts
//   rm .env.prod.migration

import { prisma } from "../lib/db";

async function main() {
  console.log("=== Ch9: adding BillingSubscription.lastBillingEventAt ===");

  const before = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'BillingSubscription' AND column_name = 'lastBillingEventAt'`,
  );
  if (before.length > 0) {
    console.log("Column already present — nothing to do.");
    return;
  }

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "BillingSubscription" ADD COLUMN IF NOT EXISTS "lastBillingEventAt" TIMESTAMP(3)`,
  );

  const after = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'BillingSubscription' AND column_name = 'lastBillingEventAt'`,
  );
  if (after.length !== 1) {
    throw new Error("Column did not land — check Aurora logs.");
  }
  console.log("✓ BillingSubscription.lastBillingEventAt added.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

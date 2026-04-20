// DDIA Ch9 Consistency & Consensus — add Organization.lastStripeAccountEventAt.
//
// Context:
//   Stripe Connect `account.updated` webhooks are at-least-once and not
//   strictly ordered. Without an ordering check, a stale retry of an
//   older event can re-stamp bankConnectedAt with now() or overwrite
//   chargesEnabled/payoutsEnabled/detailsSubmitted flags with older
//   values after a newer event has already landed. Same shape as the
//   Ch9 billing fix (BillingSubscription.lastBillingEventAt) and the
//   Ch9 dispute fix (Transaction.lastDisputeEventAt). The cure adds an
//   `eventAt` high-water mark (from Stripe's `event.created`, not our
//   server clock) and guards every UPDATE with
//     WHERE lastStripeAccountEventAt IS NULL OR lastStripeAccountEventAt < :eventAt
//   so a stale retry becomes a logged no-op. Mirrors
//   scripts/add-transaction-dispute-event-ordering.ts exactly.
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
//   npx tsx --env-file=.env.prod.migration scripts/add-organization-account-event-ordering.ts
//   rm .env.prod.migration

import { prisma } from "../lib/db";

async function main() {
  console.log("=== Ch9: adding Organization.lastStripeAccountEventAt ===");

  const before = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'Organization' AND column_name = 'lastStripeAccountEventAt'`,
  );
  if (before.length > 0) {
    console.log("Column already present — nothing to do.");
    return;
  }

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lastStripeAccountEventAt" TIMESTAMP(3)`,
  );

  const after = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'Organization' AND column_name = 'lastStripeAccountEventAt'`,
  );
  if (after.length !== 1) {
    throw new Error("Column did not land — check Aurora logs.");
  }
  console.log("✓ Organization.lastStripeAccountEventAt added.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// DDIA Ch9 Consistency & Consensus — add Transaction.lastDisputeEventAt +
// Transaction.disputeStatus.
//
// Context:
//   Stripe Issuing dispute webhooks (issuing_dispute.created / .updated /
//   .submitted) are at-least-once and not strictly ordered. The current
//   handleDisputeUpdated dedups on (disputeId, action="dispute_updated")
//   via AuditLog.findFirst — which silently drops EVERY subsequent status
//   transition after the first one lands. A dispute that walks
//   warning_needs_response → warning_under_review → warning_closed never
//   advances past the first recorded state. Same shape as the Ch9 billing
//   fix. The cure adds an `eventAt` high-water mark (from Stripe's
//   `event.created`, not our server clock) and guards every UPDATE with
//     WHERE lastDisputeEventAt IS NULL OR lastDisputeEventAt < :eventAt
//   so a stale retry becomes a logged no-op. Mirrors
//   scripts/add-billing-subscription-event-ordering.ts exactly.
//
// This script adds the two nullable columns (existing rows stay NULL — the
// WHERE clause treats NULL as "unknown / always allow" to preserve current
// behavior on first event after deploy).
//
// Safety properties:
//   - ADD COLUMN nullable — metadata-only on Postgres, no table rewrite,
//     no lock contention at production scale. Fast.
//   - IF NOT EXISTS — idempotent.
//
// Usage (from benefits-safe-app/):
//
//   vercel env pull .env.prod.migration --environment=production --yes
//   npx tsx --env-file=.env.prod.migration scripts/add-transaction-dispute-event-ordering.ts
//   rm .env.prod.migration

import { prisma } from "../lib/db";

async function main() {
  console.log("=== Ch9: adding Transaction.lastDisputeEventAt + Transaction.disputeStatus ===");

  const before = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'Transaction'
       AND column_name IN ('lastDisputeEventAt', 'disputeStatus')`,
  );
  const haveLastDisputeEventAt = before.some((r) => r.column_name === "lastDisputeEventAt");
  const haveDisputeStatus = before.some((r) => r.column_name === "disputeStatus");

  if (haveLastDisputeEventAt && haveDisputeStatus) {
    console.log("Both columns already present — nothing to do.");
    return;
  }

  if (!haveLastDisputeEventAt) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "lastDisputeEventAt" TIMESTAMP(3)`,
    );
    console.log("✓ Transaction.lastDisputeEventAt added.");
  } else {
    console.log("— Transaction.lastDisputeEventAt already present.");
  }

  if (!haveDisputeStatus) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "disputeStatus" TEXT`,
    );
    console.log("✓ Transaction.disputeStatus added.");
  } else {
    console.log("— Transaction.disputeStatus already present.");
  }

  const after = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'Transaction'
       AND column_name IN ('lastDisputeEventAt', 'disputeStatus')`,
  );
  if (after.length !== 2) {
    throw new Error(
      `Expected 2 columns to be present, found ${after.length}: ${after
        .map((r) => r.column_name)
        .join(", ")}. Check Aurora logs.`,
    );
  }
  console.log("✓ Both columns verified present.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

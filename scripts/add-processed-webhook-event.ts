// One-shot: add ProcessedWebhookEvent table for webhook idempotency.
//
// Stripe retries failed webhook deliveries for up to 3 days. Without
// idempotency, a retry could re-process a single event and cause
// double-approvals, double-ledger-debits, or double-notifications.
//
// The table stores the Stripe event.id as the primary key. Before
// processing, each webhook handler attempts to insert the event id;
// a unique-constraint violation means the event was already handled
// (either by a prior delivery or by a concurrent Lambda instance
// processing the same retry) and the handler returns 200 immediately.
//
// Retention: Stripe retry window is 72h, so rows older than ~7 days
// are unreachable. A cleanup cron can purge them later — not urgent
// at current volume.
//
// Safe to re-run: CREATE TABLE IF NOT EXISTS.

import { prisma } from "../lib/db";

async function main() {
  console.log("Creating ProcessedWebhookEvent table...");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProcessedWebhookEvent" (
      "id" TEXT NOT NULL,
      "webhookType" TEXT NOT NULL,
      "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ProcessedWebhookEvent_webhookType_processedAt_idx"
    ON "ProcessedWebhookEvent"("webhookType", "processedAt");
  `);

  console.log("Done. Verifying...");
  const rows = await prisma.$queryRawUnsafe<
    Array<{ column_name: string; data_type: string }>
  >(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'ProcessedWebhookEvent'
    ORDER BY ordinal_position;
  `);
  console.table(rows);
}

main().finally(() => prisma.$disconnect());

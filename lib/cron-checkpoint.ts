// Resumable cursor checkpoint helper for dispatcher crons.
//
// At 1.8M nonprofits a single cron firing cannot drain the Organization
// table even with pagination — the per-tick MAX_ENQUEUE budget is much
// smaller than the total. We persist the last-processed id in
// CronCheckpoint so the next firing resumes from there. When a cron
// completes a full pass over the table (batch.length === 0 OR a partial
// page is returned) we reset the cursor to null so the next tick starts
// from the beginning of the table — that's how recurring full sweeps work.
//
// One row per cron, keyed by a stable cronName like "compliance-dispatcher".

import { prisma } from "@/lib/db";

export async function readCheckpoint(cronName: string): Promise<string | null> {
  const row = await prisma.cronCheckpoint.findUnique({
    where: { cronName },
    select: { lastCursor: true },
  });
  return row?.lastCursor ?? null;
}

export async function writeCheckpoint(
  cronName: string,
  lastCursor: string | null,
  processedCount: number,
): Promise<void> {
  await prisma.cronCheckpoint.upsert({
    where: { cronName },
    update: {
      lastCursor,
      processedCount,
      lastRunAt: new Date(),
    },
    create: {
      cronName,
      lastCursor,
      processedCount,
    },
  });
}

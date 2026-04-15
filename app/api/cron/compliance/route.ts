import { NextResponse } from "next/server";
import { readCheckpoint, writeCheckpoint } from "@/lib/cron-checkpoint";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { enqueueJob, JobTypes, acquireCronLock } from "@/lib/queue";

const CRON_NAME = "compliance-dispatcher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // DDIA Ch8 — Redis-backed distributed lock. Prevents a Vercel cron
  // retry or manual invocation from running in parallel with an
  // in-flight dispatcher and double-enqueueing every org.
  const release = await acquireCronLock(CRON_NAME, 600);
  if (!release) {
    return NextResponse.json({ skipped: "already_running" });
  }

  logger.info("Compliance deep scan started — enqueuing per-org jobs");

  try {
    // Cursor-based pagination + persistent checkpoint. Each tick processes
    // at most MAX_ENQUEUE_PER_RUN orgs starting from the previous tick's
    // cursor; when we hit the end of the table the cursor resets to null
    // and the next tick begins a fresh sweep.
    const BATCH_SIZE = 500;
    const MAX_ENQUEUE_PER_RUN = 5000;

    const startCursor = await readCheckpoint(CRON_NAME);
    let cursor: string | undefined = startCursor ?? undefined;
    let enqueued = 0;
    let scanned = 0;
    let reachedEnd = false;

    while (enqueued < MAX_ENQUEUE_PER_RUN) {
      const batch: { id: string }[] = await prisma.organization.findMany({
        select: { id: true },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      });

      if (batch.length === 0) {
        reachedEnd = true;
        break;
      }
      scanned += batch.length;

      // Parallelize enqueues within the batch — QStash handles the
      // backpressure and these are independent network calls.
      const results = await Promise.allSettled(
        batch.map((org) =>
          enqueueJob("/api/jobs/run-compliance", {
            type: JobTypes.RUN_COMPLIANCE,
            data: { orgId: org.id },
          }),
        ),
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          enqueued++;
        } else {
          logger.error("Failed to enqueue compliance job", {
            error: r.reason instanceof Error ? r.reason.message : "Unknown error",
          });
        }
      }

      cursor = batch[batch.length - 1]!.id;
      if (batch.length < BATCH_SIZE) {
        // Partial last page = end of table reached.
        reachedEnd = true;
        break;
      }
    }

    // If we drained the table, reset the checkpoint to null so the next
    // tick begins a fresh sweep. Otherwise persist the cursor we reached.
    const nextCursor = reachedEnd ? null : (cursor ?? null);
    await writeCheckpoint(CRON_NAME, nextCursor, enqueued);

    logger.info("Compliance deep scan — jobs enqueued", {
      scanned,
      enqueued,
      reachedEnd,
      budgetExhausted: enqueued >= MAX_ENQUEUE_PER_RUN,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      orgsScanned: scanned,
      orgsEnqueued: enqueued,
      reachedEnd,
      lastCursor: nextCursor,
      budgetExhausted: enqueued >= MAX_ENQUEUE_PER_RUN,
    });
  } catch (error) {
    logger.error("Compliance deep scan failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  } finally {
    await release();
  }
}

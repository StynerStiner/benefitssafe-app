import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { enqueueJob, JobTypes } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info("Compliance deep scan started — enqueuing per-org jobs");

  try {
    // Cursor-based pagination: never load more than BATCH_SIZE org ids in
    // memory at once. At 1.8M nonprofits a single findMany() would OOM the
    // 300s cron Lambda. The MAX_ENQUEUE_PER_RUN budget caps work per cron
    // tick so the function returns under maxDuration; remaining orgs are
    // picked up on the next scheduled run (or by re-firing this endpoint
    // until the cursor exhausts the table).
    const BATCH_SIZE = 500;
    const MAX_ENQUEUE_PER_RUN = 5000;

    let cursor: string | undefined = undefined;
    let enqueued = 0;
    let scanned = 0;

    while (enqueued < MAX_ENQUEUE_PER_RUN) {
      const batch: { id: string }[] = await prisma.organization.findMany({
        select: { id: true },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      });

      if (batch.length === 0) break;
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
      if (batch.length < BATCH_SIZE) break;
    }

    logger.info("Compliance deep scan — jobs enqueued", {
      scanned,
      enqueued,
      budgetExhausted: enqueued >= MAX_ENQUEUE_PER_RUN,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      orgsScanned: scanned,
      orgsEnqueued: enqueued,
      lastCursor: cursor ?? null,
      budgetExhausted: enqueued >= MAX_ENQUEUE_PER_RUN,
    });
  } catch (error) {
    logger.error("Compliance deep scan failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}

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

  logger.info("Weekly grant report generation started — enqueuing per-org jobs");

  try {
    const orgs = await prisma.organization.findMany({
      select: { id: true },
    });

    let enqueued = 0;
    for (const org of orgs) {
      try {
        await enqueueJob("/api/jobs/generate-report", {
          type: JobTypes.GENERATE_REPORT,
          data: { orgId: org.id },
        });
        enqueued++;
      } catch (err) {
        logger.error("Failed to enqueue report job", {
          orgId: org.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    logger.info("Weekly report generation — jobs enqueued", {
      totalOrgs: orgs.length,
      enqueued,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      orgsEnqueued: enqueued,
      totalOrgs: orgs.length,
    });
  } catch (error) {
    logger.error("Weekly report generation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}

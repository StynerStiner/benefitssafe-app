import * as Sentry from "@sentry/nextjs";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { enqueueJob, JobTypes } from '@/lib/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  logger.info('SentinelLayer cron job started');

  try {
    // Cursor-paginated dispatcher — see app/api/cron/compliance/route.ts
    // for the same pattern. Hard cap of MAX_ENQUEUE_PER_RUN per tick so
    // the cron Lambda always returns within maxDuration.
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

      const results = await Promise.allSettled(
        batch.map((org) =>
          enqueueJob('/api/jobs/check-thresholds', {
            type: JobTypes.CHECK_THRESHOLDS,
            data: { orgId: org.id },
          }),
        ),
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          enqueued++;
        } else {
          logger.error('Failed to enqueue sentinel job', {
            error: r.reason instanceof Error ? r.reason.message : 'Unknown error',
          });
        }
      }

      cursor = batch[batch.length - 1]!.id;
      if (batch.length < BATCH_SIZE) break;
    }

    logger.info('SentinelLayer cron job completed — jobs enqueued', {
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
    Sentry.captureException(error, {
      tags: { route: '/api/cron/sentinel', method: 'GET' },
    });
    logger.error('SentinelLayer cron job failed', {
      error: error instanceof Error
        ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}

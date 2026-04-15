import * as Sentry from "@sentry/nextjs";
import { NextResponse } from 'next/server';
import { readCheckpoint, writeCheckpoint } from '@/lib/cron-checkpoint';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { enqueueJob, JobTypes, acquireCronLock } from '@/lib/queue';

const CRON_NAME = "sentinel-dispatcher";

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

  // DDIA Ch8 — distributed lock prevents concurrent dispatcher runs.
  const release = await acquireCronLock(CRON_NAME, 600);
  if (!release) {
    return NextResponse.json({ skipped: 'already_running' });
  }

  logger.info('SentinelLayer cron job started');

  try {
    // Cursor-paginated dispatcher with persistent checkpoint — see
    // app/api/cron/compliance/route.ts for the full pattern.
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
      if (batch.length < BATCH_SIZE) {
        reachedEnd = true;
        break;
      }
    }

    const nextCursor = reachedEnd ? null : (cursor ?? null);
    await writeCheckpoint(CRON_NAME, nextCursor, enqueued);

    logger.info('SentinelLayer cron job completed — jobs enqueued', {
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
  } finally {
    await release();
  }
}

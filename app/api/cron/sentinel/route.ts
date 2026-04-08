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
    // Get all organizations
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    logger.info(`Enqueuing ${orgs.length} organizations for parallel processing`);

    // Enqueue each org as a separate parallel job instead of sequential processing
    // 1,000 orgs = 1,000 parallel jobs instead of 1 sequential 30-minute loop
    let enqueued = 0;
    for (const org of orgs) {
      try {
        await enqueueJob('/api/jobs/check-thresholds', {
          type: JobTypes.CHECK_THRESHOLDS,
          data: { orgId: org.id },
        });
        enqueued++;
      } catch (err) {
        logger.error('Failed to enqueue sentinel job', {
          orgId: org.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    logger.info('SentinelLayer cron job completed — jobs enqueued', {
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

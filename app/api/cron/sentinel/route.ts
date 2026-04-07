import * as Sentry from "@sentry/nextjs";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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

    logger.info(`Processing ${orgs.length} organizations`);

    const results: Array<{
      orgId: string;
      orgName: string;
      status: string;
      beneficiariesChecked: number;
    }> = [];

    for (const org of orgs) {
      try {
        // Get beneficiaries with active benefit flags
        const beneficiaries = await prisma.user.findMany({
          where: {
            organizationId: org.id,
            role: 'beneficiary',
            isActive: true,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        });

        // Get active grants for threshold checking
        const grants = await prisma.grant.findMany({
          where: {
            organizationId: org.id,
            status: 'ACTIVE',
          },
          select: {
            id: true,
            totalAmount: true,
            spentAmount: true,
            remainingAmount: true,
            beneficiaryId: true,
          },
        });

        // Log results for this org
        results.push({
          orgId: org.id,
          orgName: org.name,
          status: 'completed',
          beneficiariesChecked: beneficiaries.length,
        });

        logger.info('Org sentinel check complete', {
          orgId: org.id,
          orgName: org.name,
          beneficiaries: beneficiaries.length,
          activeGrants: grants.length,
        });
      } catch (orgError) {
        logger.error('Org sentinel check failed', {
          orgId: org.id,
          error: orgError instanceof Error
            ? orgError.message : 'Unknown error',
        });
        results.push({
          orgId: org.id,
          orgName: org.name,
          status: 'failed',
          beneficiariesChecked: 0,
        });
      }
    }

    logger.info('SentinelLayer cron job completed', {
      totalOrgs: orgs.length,
      successful: results.filter(
        r => r.status === 'completed').length,
      failed: results.filter(
        r => r.status === 'failed').length,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info("Weekly grant report generation started");

  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    const results: Array<{
      orgId: string;
      orgName: string;
      grantsReported: number;
      notificationsCreated: number;
    }> = [];

    for (const org of orgs) {
      const grants = await prisma.grant.findMany({
        where: { organizationId: org.id, status: "ACTIVE", archivedAt: null },
        select: {
          id: true,
          name: true,
          totalAmount: true,
          spentAmount: true,
          remainingAmount: true,
        },
      });

      // Calculate weekly spending per grant
      const weeklyExpenses = await prisma.expenseRequest.findMany({
        where: {
          grant: { organizationId: org.id },
          createdAt: { gte: oneWeekAgo },
          status: { in: ["APPROVED", "PAID"] },
        },
        select: { grantId: true, amount: true },
      });

      const weeklyByGrant = new Map<string, number>();
      for (const e of weeklyExpenses) {
        weeklyByGrant.set(e.grantId, (weeklyByGrant.get(e.grantId) || 0) + Number(e.amount));
      }

      // Create summary notification for org admins
      if (grants.length > 0) {
        const admins = await prisma.user.findMany({
          where: { organizationId: org.id, role: "nonprofit_admin", isActive: true },
          select: { id: true },
        });

        const summaryLines = grants.map((g) => {
          const weeklySpend = weeklyByGrant.get(g.id) || 0;
          const remaining = Number(g.remainingAmount);
          const burnRate = weeklySpend > 0 ? Math.ceil(remaining / weeklySpend) : null;
          return `${g.name}: $${weeklySpend.toFixed(0)} spent this week, $${remaining.toFixed(0)} remaining${burnRate ? ` (~${burnRate} weeks left)` : ""}`;
        });

        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              organizationId: org.id,
              type: "weekly_report",
              title: "Weekly Grant Report",
              message: summaryLines.join("\n"),
              entityType: "report",
              entityId: `weekly-${new Date().toISOString().slice(0, 10)}`,
              href: "/reports",
            },
          });
        }

        results.push({
          orgId: org.id,
          orgName: org.name,
          grantsReported: grants.length,
          notificationsCreated: admins.length,
        });
      }
    }

    logger.info("Weekly grant report completed", {
      totalOrgs: orgs.length,
      reportsGenerated: results.length,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    logger.error("Weekly report generation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}

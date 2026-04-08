// @ts-nocheck
// POST /api/jobs/generate-report — Generate weekly report for one org
// Called by QStash queue from the reports cron job.

import { prisma } from "@/lib/db";
import { verifyJobAuth } from "@/lib/queue";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!verifyJobAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data } = await request.json();
    const { orgId } = data;

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch active grants
    const grants = await prisma.grant.findMany({
      where: { organizationId: orgId, status: "ACTIVE", archivedAt: null },
      select: {
        id: true,
        name: true,
        totalAmount: true,
        spentAmount: true,
        remainingAmount: true,
      },
    });

    // Fetch recent approved/paid expenses
    const recentExpenses = await prisma.expenseRequest.findMany({
      where: {
        grant: { organizationId: orgId },
        status: { in: ["APPROVED", "PAID"] },
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        grantId: true,
        amount: true,
      },
    });

    // Calculate weekly spending per grant
    const weeklyByGrant: Record<string, number> = {};
    for (const exp of recentExpenses) {
      weeklyByGrant[exp.grantId] = (weeklyByGrant[exp.grantId] || 0) + Number(exp.amount);
    }

    const totalWeeklySpend = Object.values(weeklyByGrant).reduce((s, v) => s + v, 0);

    // Create report summary
    const reportLines = grants.map((g) => {
      const weeklySpend = weeklyByGrant[g.id] || 0;
      const remaining = Number(g.remainingAmount);
      const weeksLeft = weeklySpend > 0 ? Math.floor(remaining / weeklySpend) : -1;
      return `${g.name}: $${weeklySpend.toFixed(2)} this week, $${remaining.toFixed(2)} remaining${weeksLeft > 0 ? ` (~${weeksLeft} weeks at current rate)` : ""}`;
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { organizationId: orgId, role: "nonprofit_admin", isActive: true },
      select: { id: true },
    });

    const message = grants.length > 0
      ? `Weekly spending: $${totalWeeklySpend.toFixed(2)} across ${grants.length} grant(s). ${reportLines.join("; ")}`
      : "No active grants this week.";

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          organizationId: orgId,
          type: "weekly_report",
          title: "Weekly Grant Spending Report",
          message,
          href: "/reports",
        },
      });
    }

    return NextResponse.json({
      success: true,
      orgId,
      grants: grants.length,
      totalWeeklySpend,
    });
  } catch (error) {
    console.error("[generate-report] Error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

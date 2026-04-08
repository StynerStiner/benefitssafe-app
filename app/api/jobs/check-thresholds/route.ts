// @ts-nocheck
// POST /api/jobs/check-thresholds — Process one org's sentinel checks
// Called by QStash queue from the sentinel cron job.
// Each org gets its own job instead of sequential processing.

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

    // Fetch beneficiaries for this org
    const beneficiaries = await prisma.user.findMany({
      where: { organizationId: orgId, role: "beneficiary", isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        benefitPrograms: true,
      },
    });

    // Fetch active grants with spending data
    const grants = await prisma.grant.findMany({
      where: { organizationId: orgId, status: "ACTIVE", archivedAt: null },
      select: {
        id: true,
        name: true,
        totalAmount: true,
        spentAmount: true,
        remainingAmount: true,
        endDate: true,
        beneficiaryId: true,
      },
    });

    const warnings: string[] = [];

    // Check grant burn rates
    for (const grant of grants) {
      const spent = Number(grant.spentAmount);
      const total = Number(grant.totalAmount);
      const remaining = Number(grant.remainingAmount);
      const burnRate = total > 0 ? spent / total : 0;

      // Warn if >80% spent
      if (burnRate > 0.8) {
        warnings.push(`Grant "${grant.name}" is ${(burnRate * 100).toFixed(0)}% spent ($${remaining.toFixed(2)} remaining)`);
      }

      // Warn if grant ending within 30 days
      if (grant.endDate) {
        const daysRemaining = Math.ceil((new Date(grant.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysRemaining <= 30 && daysRemaining > 0) {
          warnings.push(`Grant "${grant.name}" expires in ${daysRemaining} days`);
        }
      }
    }

    // Create notifications for warnings
    if (warnings.length > 0) {
      const admins = await prisma.user.findMany({
        where: { organizationId: orgId, role: "nonprofit_admin", isActive: true },
        select: { id: true },
      });

      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            organizationId: orgId,
            type: "sentinel_alert",
            title: `SentinelLayer: ${warnings.length} alert(s)`,
            message: warnings.join("; "),
            href: "/reports",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      orgId,
      beneficiaries: beneficiaries.length,
      grants: grants.length,
      warnings: warnings.length,
    });
  } catch (error) {
    console.error("[check-thresholds] Error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

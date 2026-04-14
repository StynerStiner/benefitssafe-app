// @ts-nocheck
// POST /api/jobs/check-thresholds — Process one org's sentinel checks
// Called by QStash queue from the sentinel cron job.
// Each org gets its own job instead of sequential processing.

import { prisma } from "@/lib/db";
import { verifyJobAuth } from "@/lib/queue";
import { sendEmail } from "@/lib/services/email-service";
import { buildComplianceAlertEmail } from "@/lib/services/email-templates";
import { NextResponse } from "next/server";

const APP_BASE_URL =
  process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";

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
        select: { id: true, email: true, firstName: true },
      });
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      });
      const orgName = org?.name || undefined;

      // Severity scales with how many warnings — >=3 is high, else medium.
      const severity: "medium" | "high" = warnings.length >= 3 ? "high" : "medium";
      const title = `SentinelLayer: ${warnings.length} alert(s)`;
      const message = warnings.join("; ");

      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            organizationId: orgId,
            type: "sentinel_alert",
            title,
            message,
            href: "/reports",
          },
        });

        if (admin.email) {
          const tmpl = buildComplianceAlertEmail({
            adminFirstName: admin.firstName || "there",
            alertTitle: title,
            alertDescription: message,
            severity,
            actionUrl: `${APP_BASE_URL}/reports`,
            orgName,
          });
          sendEmail({
            to: admin.email,
            subject: tmpl.subject,
            html: tmpl.html,
            text: tmpl.text,
            orgName,
            userId: admin.id,
            organizationId: orgId,
            emailType: "compliance_alert",
          }).catch((err) =>
            console.error("[check-thresholds email] failed:", err),
          );
        }
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

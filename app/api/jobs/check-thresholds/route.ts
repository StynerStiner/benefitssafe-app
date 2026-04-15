// @ts-nocheck
// POST /api/jobs/check-thresholds — Process one org's sentinel checks
// Called by QStash queue from the sentinel cron job.
// Each org gets its own job instead of sequential processing.

import { prisma } from "@/lib/db";
import { verifyJobAuth, claimJobMessage } from "@/lib/queue";
import { sendEmail } from "@/lib/services/email-service";
import { buildComplianceAlertEmail } from "@/lib/services/email-templates";
import { NextResponse } from "next/server";

const APP_BASE_URL =
  process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";

export async function POST(request: Request) {
  // DDIA Ch8 — real HMAC + messageId dedup. The existing per-warning
  // entityId dedup at :96 protects the in-app notification list, but
  // email fan-out and the cross-product createMany would both re-fire
  // if QStash delivers the same job twice. messageId dedup short-circuits
  // the whole handler on retry.
  const jobAuth = await verifyJobAuth(request);
  if (!jobAuth.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const first = await claimJobMessage(jobAuth.messageId);
  if (!first) {
    return NextResponse.json({ deduped: true, messageId: jobAuth.messageId });
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

    // Collect candidate warnings with per-warning entityIds so we can dedup.
    // Each warning has a stable key (grantId + warning kind) that lets us
    // skip re-alerting on the same condition on subsequent cron runs.
    interface CandidateWarning {
      entityId: string;
      message: string;
    }
    const candidates: CandidateWarning[] = [];

    for (const grant of grants) {
      const spent = Number(grant.spentAmount);
      const total = Number(grant.totalAmount);
      const remaining = Number(grant.remainingAmount);
      const burnRate = total > 0 ? spent / total : 0;

      // Warn if >80% spent
      if (burnRate > 0.8) {
        candidates.push({
          entityId: `${grant.id}:burn_rate`,
          message: `Grant "${grant.name}" is ${(burnRate * 100).toFixed(0)}% spent ($${remaining.toFixed(2)} remaining)`,
        });
      }

      // Warn if grant ending within 30 days
      if (grant.endDate) {
        const daysRemaining = Math.ceil((new Date(grant.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysRemaining <= 30 && daysRemaining > 0) {
          candidates.push({
            entityId: `${grant.id}:expiring`,
            message: `Grant "${grant.name}" expires in ${daysRemaining} days`,
          });
        }
      }
    }

    // Per-warning dedup: drop any candidate whose entityId was already
    // alerted today. Admins should not see "Grant X at 85%" every day —
    // one alert per 24-hour window is enough.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const newWarnings: CandidateWarning[] = [];
    for (const candidate of candidates) {
      const existingToday = await prisma.notification.count({
        where: {
          organizationId: orgId,
          type: "sentinel_alert",
          entityId: candidate.entityId,
          createdAt: { gte: startOfToday },
        },
      });
      if (existingToday === 0) {
        newWarnings.push(candidate);
      }
    }

    // Create notifications + one aggregate email per admin for any
    // warnings that are NOT already deduped.
    //
    // Bounded to 200 admins per org. The previous nested for-loop fired
    // (admins × warnings) sequential notification.create calls — at
    // 500 admins × 5 warnings that's 2500 round-trips per cron run.
    // We now flatten the cross-product and write a single createMany.
    if (newWarnings.length > 0) {
      const admins = await prisma.user.findMany({
        where: {
          organizationId: orgId,
          role: { in: ["nonprofit_admin", "platform_admin"] },
          isActive: true,
        },
        select: { id: true, email: true, firstName: true },
        take: 200,
      });
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      });
      const orgName = org?.name || undefined;

      // Severity scales with how many warnings — >=3 is high, else medium.
      const severity: "medium" | "high" =
        newWarnings.length >= 3 ? "high" : "medium";
      const title = `SentinelLayer: ${newWarnings.length} alert(s)`;
      const aggregateMessage = newWarnings.map((w) => w.message).join("; ");

      // Flat (admin × warning) cross-product — one row per pair so the
      // existing per-warning entityId dedup on subsequent cron runs
      // continues to work.
      const notificationRows = admins.flatMap((admin) =>
        newWarnings.map((warning) => ({
          userId: admin.id,
          organizationId: orgId,
          type: "sentinel_alert",
          entityId: warning.entityId,
          title: "SentinelLayer alert",
          message: warning.message,
          href: "/reports",
        })),
      );
      if (notificationRows.length > 0) {
        await prisma.notification.createMany({ data: notificationRows });
      }

      // One aggregate email per admin summarizing all new warnings.
      // Fire-and-forget — emails are not awaited so the cron job
      // returns quickly even with 200 recipients.
      for (const admin of admins) {
        if (!admin.email) continue;
        const tmpl = buildComplianceAlertEmail({
          adminFirstName: admin.firstName || "there",
          alertTitle: title,
          alertDescription: aggregateMessage,
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

    return NextResponse.json({
      success: true,
      orgId,
      beneficiaries: beneficiaries.length,
      grants: grants.length,
      warnings: newWarnings.length,
    });
  } catch (error) {
    console.error("[check-thresholds] Error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

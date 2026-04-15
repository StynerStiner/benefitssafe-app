// @ts-nocheck
// POST /api/jobs/run-compliance — Deep compliance scan for one org
// Called by QStash queue from the compliance cron job.

import { prisma } from "@/lib/db";
import { classifyExpense } from "@/utils/compliance-rules";
import { verifyJobAuth, claimJobMessage } from "@/lib/queue";
import { sendEmail } from "@/lib/services/email-service";
import { buildComplianceAlertEmail } from "@/lib/services/email-templates";
import { NextResponse } from "next/server";

const APP_BASE_URL =
  process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";

export async function POST(request: Request) {
  // DDIA Ch8 — verify real QStash HMAC + dedupe on messageId so
  // QStash's at-least-once retry doesn't duplicate reclassifications,
  // audit logs, notifications, and compliance alert emails.
  const auth = await verifyJobAuth(request);
  if (!auth.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const first = await claimJobMessage(auth.messageId);
  if (!first) {
    return NextResponse.json({ deduped: true, messageId: auth.messageId });
  }

  try {
    const { data } = await request.json();
    const { orgId } = data;

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    // Fetch recent expenses for this org
    const expenses = await prisma.expenseRequest.findMany({
      where: {
        grant: { organizationId: orgId },
        createdAt: { gte: sixHoursAgo },
      },
      include: {
        grant: { select: { benefitFlags: true } },
        vendor: { select: { type: true } },
        category: { select: { name: true } },
      },
    });

    let reclassified = 0;
    let anomalies = 0;

    for (const expense of expenses) {
      const benefitFlags = expense.grant?.benefitFlags as {
        ssi: boolean; ssdi: boolean; mediCal: boolean; medicaid: boolean; able: boolean;
      } | null;

      const result = classifyExpense(
        {
          expenseType: expense.expenseType,
          description: expense.description,
          vendorType: expense.vendor?.type ?? "ONE_TIME_VENDOR",
          amount: Number(expense.amount),
          category: expense.category?.name ?? "uncategorized",
          frequency: expense.frequency,
        },
        benefitFlags,
      );

      // Check if classification changed
      if (result.level !== expense.riskClassification) {
        const oldLevel = expense.riskClassification;
        await prisma.expenseRequest.update({
          where: { id: expense.id },
          data: {
            riskClassification: result.level,
            riskNotes: `[Reclassified] ${result.reason}`,
          },
        });
        reclassified++;

        // Audit log for reclassification
        await prisma.auditLog.create({
          data: {
            userId: "system",
            organizationId: orgId,
            action: "compliance_reclassify",
            entityType: "expense",
            entityId: expense.id,
            oldValue: { riskClassification: oldLevel },
            newValue: { riskClassification: result.level, reason: result.reason },
          },
        });

        // Notify admins + compliance officers if risk level increased
        const riskOrder = ["LIKELY_SAFE", "NEEDS_REVIEW", "LIKELY_RISKY", "BLOCKED"];
        const oldIdx = riskOrder.indexOf(oldLevel || "LIKELY_SAFE");
        const newIdx = riskOrder.indexOf(result.level);
        if (newIdx > oldIdx) {
          const recipients = await prisma.user.findMany({
            where: {
              organizationId: orgId,
              role: {
                in: ["nonprofit_admin", "compliance_officer", "platform_admin"],
              },
              isActive: true,
            },
            select: { id: true, email: true, firstName: true },
          });
          const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { name: true },
          });
          const orgName = org?.name || undefined;
          // BLOCKED reclassifications email immediately (someone cannot
          // spend — critical). All other reclassifications (LIKELY_RISKY,
          // NEEDS_REVIEW) stay in-app only so admins aren't flooded with
          // routine risk bumps.
          const isBlocked = result.level === "BLOCKED";
          const title = "Expense reclassified to higher risk";
          const message = `Expense "${expense.description}" was reclassified from ${oldLevel} to ${result.level}. Please review.`;

          for (const admin of recipients) {
            await prisma.notification.create({
              data: {
                userId: admin.id,
                organizationId: orgId,
                type: "compliance_reclassified",
                title,
                message,
                entityType: "expense",
                entityId: expense.id,
                href: "/expenses",
              },
            });

            if (isBlocked && admin.email) {
              const tmpl = buildComplianceAlertEmail({
                adminFirstName: admin.firstName || "there",
                alertTitle: title,
                alertDescription: message,
                severity: "critical",
                actionUrl: `${APP_BASE_URL}/expenses`,
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
                console.error("[run-compliance email] failed:", err),
              );
            }
          }
        }
      }

      // Velocity check: >10 expenses by same user in 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const velocityCount = await prisma.expenseRequest.count({
        where: {
          requestedById: expense.requestedById,
          createdAt: { gte: oneHourAgo },
        },
      });

      if (velocityCount > 10) {
        anomalies++;
      }

      // Amount anomaly: >$500
      if (Number(expense.amount) > 500) {
        anomalies++;
      }
    }

    return NextResponse.json({
      success: true,
      orgId,
      scanned: expenses.length,
      reclassified,
      anomalies,
    });
  } catch (error) {
    console.error("[run-compliance] Error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

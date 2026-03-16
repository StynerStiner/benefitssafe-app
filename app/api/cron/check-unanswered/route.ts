// GET /api/cron/check-unanswered — Check for unanswered beneficiary messages
// Run this on a schedule (e.g., every hour via Vercel Cron or external cron)
//
// Escalation rules:
// - 24 hours: No staff response to a NEW beneficiary message → notify all org admins
// - 48 hours: Still no response → send URGENT notification to all org admins
//
// This ensures no beneficiary is left waiting. If a staff member is out,
// the manager gets notified and can join the conversation.

import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

const FIRST_ESCALATION_HOURS = 24;
const URGENT_ESCALATION_HOURS = 48;

export async function GET(request: Request) {
  try {
    // Verify cron secret (in production, use a secret to prevent abuse)
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - FIRST_ESCALATION_HOURS * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - URGENT_ESCALATION_HOURS * 60 * 60 * 1000);

    // Find all conversations where the last message was from a beneficiary
    // and no staff member has responded within the escalation window
    const conversations = await prisma.conversation.findMany({
      where: {
        messages: {
          some: {
            createdAt: { lt: twentyFourHoursAgo },
          },
        },
      },
      select: {
        id: true,
        organizationId: true,
        updatedAt: true,
        participants: {
          select: { userId: true },
        },
        messages: {
          select: {
            id: true,
            senderId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    let escalationCount = 0;

    for (const convo of conversations) {
      const lastMessage = convo.messages[0];
      if (!lastMessage) continue;

      // Get the sender's role to check if they're a beneficiary
      const sender = await prisma.user.findUnique({
        where: { id: lastMessage.senderId },
        select: { role: true, firstName: true, lastName: true },
      });

      if (!sender) continue;

      // Escalate if the last message was from any non-admin role that needs a response
      // Client roles: beneficiary, vendor
      // Professional roles: CPA, auditor, attorney, grant_officer (ignoring them is equally bad)
      // Staff-to-staff and admin messages don't escalate
      const escalatableRoles = [
        "beneficiary", "vendor", "cpa", "auditor", "attorney", "grant_officer",
      ];
      if (!escalatableRoles.includes(sender.role)) continue;

      const messageAge = now.getTime() - new Date(lastMessage.createdAt).getTime();
      const hoursOld = messageAge / (1000 * 60 * 60);

      // Determine escalation level
      let escalationType: "first" | "urgent" | null = null;
      if (hoursOld >= URGENT_ESCALATION_HOURS) {
        escalationType = "urgent";
      } else if (hoursOld >= FIRST_ESCALATION_HOURS) {
        escalationType = "first";
      }

      if (!escalationType) continue;

      // Check if we already sent this escalation notification
      const existingNotification = await prisma.notification.findFirst({
        where: {
          organizationId: convo.organizationId,
          type: escalationType === "urgent" ? "unanswered_urgent" : "unanswered_warning",
          entityType: "conversation",
          entityId: convo.id,
          createdAt: { gt: twentyFourHoursAgo }, // Don't re-notify within 24h
        },
      });

      if (existingNotification) continue;

      // Find all admins in this organization
      const admins = await prisma.user.findMany({
        where: {
          organizationId: convo.organizationId,
          role: { in: ["nonprofit_admin", "platform_admin"] },
          isActive: true,
        },
        select: { id: true },
      });

      // Role-aware labels for notification messages
      const roleLabels: Record<string, string> = {
        beneficiary: "beneficiary",
        vendor: "vendor",
        cpa: "CPA",
        auditor: "auditor",
        attorney: "attorney",
        grant_officer: "grant officer",
      };
      const roleLabel = roleLabels[sender.role] || sender.role;
      const isProfessional = ["cpa", "auditor", "attorney", "grant_officer"].includes(sender.role);

      const timeLabel = hoursOld >= 48
        ? `${Math.floor(hoursOld)}h without a response`
        : "over 24h without a response";

      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          organizationId: convo.organizationId,
          type: escalationType === "urgent" ? "unanswered_urgent" : "unanswered_warning",
          title: escalationType === "urgent"
            ? `URGENT: ${sender.firstName} ${sender.lastName} (${roleLabel}) waiting ${timeLabel}`
            : `${sender.firstName} ${sender.lastName} (${roleLabel}) waiting ${timeLabel}`,
          message: escalationType === "urgent"
            ? isProfessional
              ? `Your organization's ${roleLabel} has not received a response in over 48 hours. This may delay compliance or legal reviews. Please respond immediately.`
              : `A ${roleLabel} has not received a response in over 48 hours. Please review and respond immediately.`
            : isProfessional
              ? `Your ${roleLabel} sent a message over 24 hours ago. Professional roles expect timely responses. Please review.`
              : `A ${roleLabel} sent a message over 24 hours ago and hasn't received a response. Please review.`,
          entityType: "conversation",
          entityId: convo.id,
          href: "/messages",
        })),
      });

      escalationCount++;
    }

    return NextResponse.json({
      message: `Checked conversations. ${escalationCount} escalation(s) sent.`,
      checkedAt: now.toISOString(),
      escalations: escalationCount,
    });
  } catch (error) {
    console.error("Cron check-unanswered error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

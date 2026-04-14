// GET /api/cron/check-unanswered — Check for unanswered beneficiary messages
// Run this on a schedule (e.g., every hour via Vercel Cron or external cron)
//
// Escalation rules:
// - 24 hours: No staff response to a NEW beneficiary message → notify all org admins
// - 48 hours: Still no response → send URGENT notification to all org admins
//
// This ensures no beneficiary is left waiting. If a staff member is out,
// the manager gets notified and can join the conversation.

import { readCheckpoint, writeCheckpoint } from "@/lib/cron-checkpoint";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

const FIRST_ESCALATION_HOURS = 24;
const URGENT_ESCALATION_HOURS = 48;
const CRON_NAME = "check-unanswered";

export async function GET(request: Request) {
  try {
    // Verify cron secret (in production, use a secret to prevent abuse)
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - FIRST_ESCALATION_HOURS * 60 * 60 * 1000);
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    // Cursor-paginated scan + windowed candidate set. The previous query
    // loaded EVERY conversation that had ever had a message older than
    // 24h — at 1.8M nonprofits × 100 conversations each = 180M rows in
    // one Lambda. We now:
    //   1. Restrict to conversations updated in the last 72h (covers
    //      the 24h and 48h escalation thresholds; older conversations
    //      were either already escalated or are stale).
    //   2. Page through them in batches of 200.
    //   3. Cap total processed per run to MAX_PER_RUN.
    //   4. Eagerly include the latest message + its sender's role so we
    //      avoid the per-conversation findUnique N+1.
    const BATCH_SIZE = 200;
    const MAX_PER_RUN = 2000;
    const escalatableRoles = [
      "beneficiary", "vendor", "cpa", "auditor", "attorney", "grant_officer",
    ];

    interface ConvoRow {
      id: string;
      organizationId: string;
      updatedAt: Date;
      messages: Array<{ id: string; senderId: string; createdAt: Date }>;
    }

    const startCursor = await readCheckpoint(CRON_NAME);
    let cursor: string | undefined = startCursor ?? undefined;
    let processed = 0;
    let escalationCount = 0;
    let reachedEnd = false;

    while (processed < MAX_PER_RUN) {
      const conversations: ConvoRow[] = await prisma.conversation.findMany({
        where: {
          updatedAt: { gte: seventyTwoHoursAgo },
        },
        select: {
          id: true,
          organizationId: true,
          updatedAt: true,
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
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      });

      if (conversations.length === 0) {
        reachedEnd = true;
        break;
      }
      processed += conversations.length;

      // Batched sender lookup: one query for all latest senders in this
      // batch instead of N findUnique calls. The Message model has no
      // direct `sender` relation in the Prisma schema, so we resolve
      // senderIds against User in bulk and build a Map.
      const senderIds = Array.from(
        new Set(
          conversations
            .map((c) => c.messages[0]?.senderId)
            .filter((id): id is string => !!id),
        ),
      );
      const senders = senderIds.length
        ? await prisma.user.findMany({
            where: { id: { in: senderIds } },
            select: { id: true, role: true, firstName: true, lastName: true },
          })
        : [];
      const senderById = new Map(senders.map((s) => [s.id, s]));

      // Pre-fetch any escalation notifications already sent in the last
      // 24h for THIS BATCH of conversations — turns the per-conversation
      // findFirst into one batched query.
      const batchConvIds = conversations.map((c) => c.id);
      const existingEscalations = await prisma.notification.findMany({
        where: {
          entityType: "conversation",
          entityId: { in: batchConvIds },
          type: { in: ["unanswered_warning", "unanswered_urgent"] },
          createdAt: { gt: twentyFourHoursAgo },
        },
        select: { entityId: true, type: true },
      });
      const escalatedKeys = new Set(
        existingEscalations.map((e) => `${e.entityId}:${e.type}`),
      );

    for (const convo of conversations) {
      const lastMessage = convo.messages[0];
      if (!lastMessage) continue;

      const sender = senderById.get(lastMessage.senderId);
      if (!sender) continue;
      if (!escalatableRoles.includes(sender.role)) continue;

      const messageAge = now.getTime() - new Date(lastMessage.createdAt).getTime();
      const hoursOld = messageAge / (1000 * 60 * 60);

      let escalationType: "first" | "urgent" | null = null;
      if (hoursOld >= URGENT_ESCALATION_HOURS) {
        escalationType = "urgent";
      } else if (hoursOld >= FIRST_ESCALATION_HOURS) {
        escalationType = "first";
      }
      if (!escalationType) continue;

      const notifKey = `${convo.id}:${escalationType === "urgent" ? "unanswered_urgent" : "unanswered_warning"}`;
      if (escalatedKeys.has(notifKey)) continue;

      // Find all admins in this organization
      const admins = await prisma.user.findMany({
        where: {
          organizationId: convo.organizationId,
          role: { in: ["nonprofit_admin", "platform_admin"] },
          isActive: true,
        },
        select: { id: true },
        take: 100,
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

      cursor = conversations[conversations.length - 1]!.id;
      if (conversations.length < BATCH_SIZE) {
        reachedEnd = true;
        break;
      }
    }

    await writeCheckpoint(
      CRON_NAME,
      reachedEnd ? null : (cursor ?? null),
      processed,
    );

    return NextResponse.json({
      message: `Checked conversations. ${escalationCount} escalation(s) sent.`,
      checkedAt: now.toISOString(),
      processed,
      escalations: escalationCount,
      reachedEnd,
      budgetExhausted: processed >= MAX_PER_RUN,
    });
  } catch (error) {
    console.error("Cron check-unanswered error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

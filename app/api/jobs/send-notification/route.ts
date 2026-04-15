// @ts-nocheck
// POST /api/jobs/send-notification — Async notification creation
// Called by QStash queue. Creates a notification record and
// can be extended to send push/email/Slack in the future.

import { prisma } from "@/lib/db";
import { verifyJobAuth, claimJobMessage } from "@/lib/queue";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // DDIA Ch8 — real QStash HMAC + messageId dedup. Without dedup, a
  // QStash retry silently creates a second notification row with no
  // way to distinguish it from a legitimate second notification on
  // the same entity.
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
    const { userId, organizationId, type, title, message, entityType, entityId, href } = data;

    if (!userId || !organizationId || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await prisma.notification.create({
      data: {
        userId,
        organizationId,
        type: type || "system",
        title,
        message,
        entityType: entityType || null,
        entityId: entityId || null,
        href: href || null,
        read: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[send-notification] Error:", error);
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
  }
}

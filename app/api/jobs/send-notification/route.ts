// @ts-nocheck
// POST /api/jobs/send-notification — Async notification creation
// Called by QStash queue. Creates a notification record and
// can be extended to send push/email/Slack in the future.

import { prisma } from "@/lib/db";
import { verifyJobAuth } from "@/lib/queue";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!verifyJobAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

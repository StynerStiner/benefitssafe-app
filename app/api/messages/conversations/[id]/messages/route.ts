// POST /api/messages/conversations/[id]/messages — Send a message

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    // Verify user is a participant
    const participation = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.user.id,
        },
      },
    });

    if (!participation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        content: content.trim(),
      },
      select: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Notify other participants
    const otherParticipants = await prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        userId: { not: session.user.id },
      },
      select: { userId: true },
    });

    if (otherParticipants.length > 0) {
      await prisma.notification.createMany({
        data: otherParticipants.map((p) => ({
          userId: p.userId,
          organizationId: session.user.organizationId,
          type: "new_message",
          title: `${session.user.firstName} ${session.user.lastName}`,
          message: content.substring(0, 100),
          entityType: "conversation",
          entityId: conversationId,
          href: "/messages",
        })),
      });
    }

    // Fire-and-forget audit log — every message reply is recorded for compliance.
    // Do not block the response; log errors to console.
    prisma.auditLog
      .create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId ?? "unknown",
          action: "send_message",
          entityType: "conversation",
          entityId: conversationId,
          oldValue: {},
          newValue: { messageId: message.id },
        },
      })
      .catch((err) => console.error("audit log write failed:", err));

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("POST /api/messages/conversations/[id]/messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

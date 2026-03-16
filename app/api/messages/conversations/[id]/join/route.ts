// POST /api/messages/conversations/[id]/join — Manager joins a conversation
// Used when taking over for a colleague who is out, fired, or unavailable

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Only managers can join conversations" }, { status: 403 });
    }

    const { id: conversationId } = await params;

    // Verify conversation belongs to this org
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      select: { id: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Check if already a participant
    const existing = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.user.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ message: "Already in this conversation" });
    }

    // Join the conversation
    await prisma.conversationParticipant.create({
      data: {
        conversationId,
        userId: session.user.id,
        role: "admin",
      },
    });

    // Send a system-style message so the beneficiary knows
    await prisma.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        content: `${session.user.firstName} ${session.user.lastName} has joined this conversation and will be following up with you.`,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "join_conversation",
        entityType: "conversation",
        entityId: conversationId,
      },
    });

    return NextResponse.json({ message: "Joined conversation" });
  } catch (error) {
    console.error("POST /api/messages/conversations/[id]/join error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

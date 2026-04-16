// GET /api/messages/conversations/[id] — Get conversation with messages

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { role, organizationId } = session.user;
    const isManager = role === "nonprofit_admin" || role === "platform_admin";

    // Check if user is a participant
    const participation = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: session.user.id,
        },
      },
    });

    // Managers can view any conversation in their org (oversight)
    if (!participation) {
      if (isManager) {
        const convo = await prisma.conversation.findFirst({
          where: { id, organizationId },
          select: { id: true },
        });
        if (!convo) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
      } else {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    // Get conversation with messages
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        subject: true,
        type: true,
        department: true,
        participants: {
          select: { userId: true, lastReadAt: true, role: true },
        },
        messages: {
          select: {
            id: true,
            senderId: true,
            content: true,
            attachmentUrl: true,
            attachmentName: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get user info for all participants and message senders
    const allUserIds = new Set<string>();
    for (const p of conversation.participants) allUserIds.add(p.userId);
    for (const m of conversation.messages) allUserIds.add(m.senderId);

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) }, organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
    });

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    // Mark as read
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: session.user.id,
        },
      },
      data: { lastReadAt: new Date() },
    });

    return NextResponse.json({
      ...conversation,
      users: userMap,
    });
  } catch (error) {
    console.error("GET /api/messages/conversations/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

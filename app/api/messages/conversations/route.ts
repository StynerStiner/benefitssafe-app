// GET  /api/messages/conversations — List user's conversations
// POST /api/messages/conversations — Create new conversation

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { role, organizationId } = session.user;
    const isManager = role === "nonprofit_admin" || role === "platform_admin";
    const viewAll = request.nextUrl?.searchParams?.get("all") === "true" && isManager;

    // Managers can see ALL org conversations for oversight
    // Regular users only see their own
    const participations = await prisma.conversationParticipant.findMany({
      where: viewAll
        ? { conversation: { organizationId } }
        : { userId },
      select: {
        conversationId: true,
        lastReadAt: true,
        conversation: {
          select: {
            id: true,
            subject: true,
            type: true,
            department: true,
            updatedAt: true,
            participants: {
              select: {
                userId: true,
              },
            },
            messages: {
              select: {
                id: true,
                content: true,
                senderId: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: "desc" } },
    });

    // Get all participant user info in one query
    const allUserIds = new Set<string>();
    for (const p of participations) {
      for (const participant of p.conversation.participants) {
        allUserIds.add(participant.userId);
      }
    }

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const conversations = participations.map((p) => {
      const lastMessage = p.conversation.messages[0] || null;
      const otherParticipants = p.conversation.participants
        .filter((pt) => pt.userId !== userId)
        .map((pt) => userMap.get(pt.userId))
        .filter(Boolean);

      const unreadCount = lastMessage && new Date(lastMessage.createdAt) > new Date(p.lastReadAt) ? 1 : 0;

      return {
        id: p.conversation.id,
        subject: p.conversation.subject,
        type: p.conversation.type,
        department: p.conversation.department,
        participants: otherParticipants,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          senderId: lastMessage.senderId,
          senderName: userMap.get(lastMessage.senderId),
          createdAt: lastMessage.createdAt,
        } : null,
        unreadCount,
        updatedAt: p.conversation.updatedAt,
      };
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("GET /api/messages/conversations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { recipientId, subject, message, department } = body;

    if (!recipientId || !message) {
      return NextResponse.json({ error: "recipientId and message are required" }, { status: 400 });
    }

    // Verify recipient exists and is in the same org
    const recipient = await prisma.user.findFirst({
      where: {
        id: recipientId,
        organizationId: session.user.organizationId,
      },
      select: { id: true },
    });

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    // Check if direct conversation already exists between these two users
    const existingConvo = await prisma.conversation.findFirst({
      where: {
        type: "direct",
        organizationId: session.user.organizationId,
        AND: [
          { participants: { some: { userId: session.user.id } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      select: { id: true },
    });

    let conversationId: string;

    if (existingConvo) {
      conversationId = existingConvo.id;
    } else {
      // Create new conversation
      const convo = await prisma.conversation.create({
        data: {
          organizationId: session.user.organizationId,
          subject: subject || null,
          type: department ? "department" : "direct",
          department: department || null,
          participants: {
            create: [
              { userId: session.user.id },
              { userId: recipientId },
            ],
          },
        },
        select: { id: true },
      });
      conversationId = convo.id;
    }

    // Send message
    await prisma.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        content: message,
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Create notification for recipient
    await prisma.notification.create({
      data: {
        userId: recipientId,
        organizationId: session.user.organizationId,
        type: "new_message",
        title: `New message from ${session.user.firstName} ${session.user.lastName}`,
        message: message.substring(0, 100),
        entityType: "conversation",
        entityId: conversationId,
        href: "/messages",
      },
    });

    return NextResponse.json({ conversationId }, { status: 201 });
  } catch (error) {
    console.error("POST /api/messages/conversations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

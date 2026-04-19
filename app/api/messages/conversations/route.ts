// GET  /api/messages/conversations -- List user's conversations
// POST /api/messages/conversations -- Create new conversation

import { auth } from "@/auth";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  hashParams,
  jitterTtl,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { createConversationSchema } from "@/lib/validations/conversation";
import { NextRequest, NextResponse } from "next/server";

const ROUTE_GET = "api/messages/conversations:GET";
const ROUTE_POST = "api/messages/conversations:POST";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { role, organizationId } = session.user;
    const isManager = role === "nonprofit_admin" || role === "platform_admin";

    const params = request.nextUrl.searchParams;
    const viewAll = params.get("all") === "true" && isManager;
    const limit = Math.min(parseInt(params.get("limit") || "25", 10) || 25, 100);
    const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

    // Managers can see ALL org conversations for oversight
    // Regular users only see their own
    const participationWhere = viewAll
      ? { conversation: { organizationId } }
      : { userId };

    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:${organizationId}:conversations:list:${userId}:${hashParams(request)}`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.LIST.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.LIST.maxStaleSeconds,
      fetcher: () =>
        buildConversationsListResponse({
          participationWhere,
          userId,
          limit,
          offset,
        }),
    });

    if (staleResult.kind === "unavailable") {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_GET,
        method: "GET",
        retryAfterSeconds: 30,
      });
    }

    if (staleResult.kind === "stale") {
      return NextResponse.json(
        {
          ...staleResult.data,
          _meta: {
            stale: true,
            staleSeconds: staleResult.staleSeconds,
            cachedAt: staleResult.cachedAt,
          },
        },
        { headers: { "X-Data-Staleness": String(staleResult.staleSeconds) } },
      );
    }

    return NextResponse.json(staleResult.data);
  } catch (error) {
    console.error("GET /api/messages/conversations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function buildConversationsListResponse(opts: {
  participationWhere: Record<string, unknown>;
  userId: string;
  limit: number;
  offset: number;
}) {
  const { participationWhere, userId, limit, offset } = opts;

    const [participations, total] = await Promise.all([
      prisma.conversationParticipant.findMany({
        where: participationWhere,
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
        take: limit,
        skip: offset,
      }),
      prisma.conversationParticipant.count({ where: participationWhere }),
    ]);

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

    return { conversations, total, limit, offset };
}

export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createConversationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { recipientId, subject, message, department } = parsed.data;

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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        action: existingConvo ? "send_message" : "create",
        entityType: "conversation",
        entityId: conversationId,
        newValue: {
          recipientId,
          isNewConversation: !existingConvo,
          department: department || null,
        },
      },
    });

    return NextResponse.json({ conversationId }, { status: 201 });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_POST,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    console.error("POST /api/messages/conversations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

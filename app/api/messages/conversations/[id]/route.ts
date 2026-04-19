// GET /api/messages/conversations/[id] — Get conversation with messages

import { auth } from "@/auth";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  jitterTtl,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/messages/conversations/[id]:GET";

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
    const userId = session.user.id;

    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:${organizationId}:conversations:detail:${id}:${userId}`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.LIST.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.LIST.maxStaleSeconds,
      fetcher: () =>
        buildConversationDetailResponse({
          id,
          userId,
          organizationId,
          role,
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

    if (staleResult.data === null) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    console.error("GET /api/messages/conversations/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Side-effect note: the mark-as-read write (conversationParticipant.update
// lastReadAt) fires inside this fetcher. On a cachedWithStaleness stale
// hit, the fetcher is NOT called, so mark-as-read is skipped. That's a
// deliberate trade-off for P2c: during Aurora degradation the user
// sees cached conversation content WITHOUT a fresh read-receipt write.
// Next healthy-mode GET will update lastReadAt. Acceptable vs. hanging
// the request on a degraded Aurora write.
async function buildConversationDetailResponse(opts: {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
}) {
  const { id, userId, organizationId, role } = opts;
  const isManager = role === "nonprofit_admin" || role === "platform_admin";

  // Check if user is a participant
  const participation = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId,
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
      if (!convo) return null;
    } else {
      return null;
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

  if (!conversation) return null;

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

  // Mark as read — only fires on fresh path. On stale path (cache hit
  // during degraded mode) this write is skipped.
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId,
      },
    },
    data: { lastReadAt: new Date() },
  });

  return {
    ...conversation,
    users: userMap,
  };
}

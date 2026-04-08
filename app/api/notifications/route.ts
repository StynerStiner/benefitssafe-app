// GET  /api/notifications — Get notifications for current user
// PATCH /api/notifications — Mark notifications as read

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");
    const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";
    const typeFilter = request.nextUrl.searchParams.get("type");

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };
    if (unreadOnly) {
      where.read = false;
    }
    if (typeFilter) {
      const types = typeFilter.split(",").map((t) => t.trim()).filter(Boolean);
      if (types.length === 1) {
        where.type = types[0];
      } else if (types.length > 1) {
        where.type = { in: types };
      }
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: where as never,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: session.user.id, read: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount }, {
      headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=10' },
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Delete specific notifications or all read notifications
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { notificationIds } = body;

    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      // Delete specific notifications (verify they belong to this user)
      await prisma.notification.deleteMany({
        where: { id: { in: notificationIds }, userId: session.user.id },
      });
    } else {
      // Delete all read notifications for this user
      await prisma.notification.deleteMany({
        where: { userId: session.user.id, read: true },
      });
    }

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("DELETE /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Mark all or specific notifications as read
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { notificationId } = body;

    if (notificationId) {
      // Verify the notification belongs to the current user (prevent IDOR)
      await prisma.notification.updateMany({
        where: { id: notificationId, userId: session.user.id },
        data: { read: true },
      });
    } else {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
      });
    }

    return NextResponse.json({ message: "Marked as read" });
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

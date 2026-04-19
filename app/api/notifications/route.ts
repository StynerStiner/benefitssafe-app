// GET    /api/notifications — Get notifications for current user
// DELETE /api/notifications — Delete specific or all read notifications
// PATCH  /api/notifications — Mark notifications as read

import { GuardDenial, requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { NextRequest, NextResponse } from "next/server";

const ROUTE_GET = "api/notifications:GET";
const ROUTE_DELETE = "api/notifications:DELETE";
const ROUTE_PATCH = "api/notifications:PATCH";

export async function GET(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireAuth(ROUTE_GET, "GET");

    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");
    const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";
    const typeFilter = request.nextUrl.searchParams.get("type");

    const where: Record<string, unknown> = {
      userId,
      organizationId, // Required for partition pruning
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
        where: { userId, organizationId, read: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount }, {
      headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=10' },
    });
  } catch (error) {
    if (error instanceof GuardDenial) return error.toErrorResponse();
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_GET,
      method: "GET",
      cause: error,
    });
  }
}

// Delete specific notifications or all read notifications
export async function DELETE(request: Request) {
  try {
    await assertDbHealthy();
    const { userId } = await requireAuth(ROUTE_DELETE, "DELETE");

    const body = await request.json().catch(() => ({}));
    const { notificationIds } = body;

    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      // Delete specific notifications (verify they belong to this user)
      await prisma.notification.deleteMany({
        where: { id: { in: notificationIds }, userId },
      });
    } else {
      // Delete all read notifications for this user
      await prisma.notification.deleteMany({
        where: { userId, read: true },
      });
    }

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_DELETE,
        method: "DELETE",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    if (error instanceof GuardDenial) return error.toErrorResponse();
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_DELETE,
      method: "DELETE",
      cause: error,
    });
  }
}

// Mark all or specific notifications as read
export async function PATCH(request: Request) {
  try {
    await assertDbHealthy();
    const { userId } = await requireAuth(ROUTE_PATCH, "PATCH");

    const body = await request.json().catch(() => ({}));
    const { notificationId } = body;

    if (notificationId) {
      // Verify the notification belongs to the current user (prevent IDOR)
      await prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { read: true },
      });
    } else {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
    }

    return NextResponse.json({ message: "Marked as read" });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_PATCH,
        method: "PATCH",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    if (error instanceof GuardDenial) return error.toErrorResponse();
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_PATCH,
      method: "PATCH",
      cause: error,
    });
  }
}

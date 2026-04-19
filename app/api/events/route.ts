// ORG-SCOPED: All queries filtered by session.user.organizationId
// GET  /api/events — List calendar events for org, with synthesized
//                    grant-lifecycle entries merged in
// POST /api/events — Create a calendar event

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
import { NextRequest, NextResponse } from "next/server";

const ROUTE_GET = "api/events:GET";
const ROUTE_POST = "api/events:POST";

// Synthetic event IDs use this prefix so the PATCH/DELETE handlers can
// detect and reject them — grant dates are derived, not first-class rows,
// and must be edited on the Grant itself, not the calendar.
const SYNTHETIC_GRANT_PREFIX = "grant:";

// Returns ms between now and `date` (can be negative if past).
function msUntil(date: Date): number {
  return date.getTime() - Date.now();
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, role, id: userId } = session.user;

    // Vendors have no calendar use case on BenefitsSafe — return empty
    // rather than leaking grant dates from the nonprofit they transact with.
    // Short-circuit before the cache/Aurora dance — no DB hit, no cache entry.
    if (role === "vendor") {
      return NextResponse.json({ events: [] });
    }

    const cacheKey = `${STALE_CACHE_KEY_PREFIX}:${organizationId}:events:list:${role}:${userId}:${hashParams(request)}`;
    const staleResult = await cachedWithStaleness({
      key: cacheKey,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.LIST.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.LIST.maxStaleSeconds,
      fetcher: () => buildEventsResponse(request, organizationId, role, userId),
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
    console.error("GET /api/events error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function buildEventsResponse(
  request: NextRequest,
  organizationId: string,
  role: string,
  userId: string,
) {
  const searchParams = request.nextUrl.searchParams;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;

    const where: Record<string, unknown> = {
      organizationId,
    };

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
      where.startDate = dateFilter;
    }

    // 1. Real calendar rows.
    const realEvents = await prisma.calendarEvent.findMany({
      where: where as never,
      orderBy: { startDate: "asc" },
    });

    // 2. Grant-derived synthetic events. Beneficiaries see only their own
    //    grants; admins and other roles see every grant for the org.
    const grantWhere: Record<string, unknown> = {
      organizationId,
      status: { in: ["ACTIVE", "DRAFT", "PAUSED"] },
    };
    if (role === "beneficiary") {
      grantWhere.beneficiaryId = userId;
    }

    const grants = await prisma.grant.findMany({
      where: grantWhere as never,
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const nowIso = now.toISOString();

    type SyntheticEvent = {
      id: string;
      title: string;
      description: string | null;
      startDate: string;
      endDate: string | null;
      category: string;
      color: string | null;
      createdById: string;
      organizationId: string;
      createdAt: string;
      updatedAt: string;
      synthetic: true;
    };

    const synthetic: SyntheticEvent[] = [];

    for (const g of grants) {
      const startIso = g.startDate.toISOString();
      synthetic.push({
        id: `${SYNTHETIC_GRANT_PREFIX}${g.id}:start`,
        title: `Grant Start: ${g.name}`,
        description: `Grant "${g.name}" begins. Status: ${g.status}.`,
        startDate: startIso,
        endDate: null,
        category: "grants",
        color: null,
        createdById: "system",
        organizationId,
        createdAt: nowIso,
        updatedAt: nowIso,
        synthetic: true,
      });

      if (g.endDate) {
        const endIso = g.endDate.toISOString();
        synthetic.push({
          id: `${SYNTHETIC_GRANT_PREFIX}${g.id}:end`,
          title: `Grant End: ${g.name}`,
          description: `Grant "${g.name}" closes.`,
          startDate: endIso,
          endDate: null,
          category: "grants",
          color: null,
          createdById: "system",
          organizationId,
          createdAt: nowIso,
          updatedAt: nowIso,
          synthetic: true,
        });

        // "Expiring soon" warning 30 days before end date, only if we're
        // currently within the 30-day window and the grant hasn't ended.
        const untilEnd = msUntil(g.endDate);
        if (untilEnd > 0 && untilEnd <= THIRTY_DAYS_MS) {
          synthetic.push({
            id: `${SYNTHETIC_GRANT_PREFIX}${g.id}:expire`,
            title: `Grant Expiring Soon: ${g.name}`,
            description: `Grant "${g.name}" ends in ${Math.ceil(untilEnd / (24 * 60 * 60 * 1000))} days.`,
            // Show the warning today so it appears on the current week.
            startDate: nowIso,
            endDate: null,
            category: "compliance",
            color: null,
            createdById: "system",
            organizationId,
            createdAt: nowIso,
            updatedAt: nowIso,
            synthetic: true,
          });
        }
      }
    }

    // Apply the caller's start/end window to synthetic events too.
    const filteredSynthetic = synthetic.filter((s) => {
      const d = new Date(s.startDate);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });

    const events = [...realEvents, ...filteredSynthetic].sort((a, b) => {
      const aTime = new Date(a.startDate).getTime();
      const bTime = new Date(b.startDate).getTime();
      return aTime - bTime;
    });

    return { events };
}

export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;

    // Only nonprofit_admin or platform_admin can create events
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, startDate, endDate, category, color } = body;

    if (!title || !startDate) {
      return NextResponse.json(
        { error: "Title and start date are required" },
        { status: 400 }
      );
    }

    const event = await prisma.calendarEvent.create({
      data: {
        organizationId,
        title,
        description: description || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        category: category || "general",
        color: color || null,
        createdById: userId,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "create",
        entityType: "calendar_event",
        entityId: event.id,
        newValue: { title, startDate, endDate, category } as never,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
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
    console.error("POST /api/events error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

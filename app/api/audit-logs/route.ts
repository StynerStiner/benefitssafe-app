// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { auditLogQuerySchema } from "@/lib/validations/audit-log";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ROLES = [
  "nonprofit_admin",
  "nonprofit_staff",
  "cpa",
  "auditor",
  "attorney",
  "platform_admin",
  "compliance_officer",
  "grant_officer",
];

// GET /api/audit-logs -- list audit logs with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { organizationId, role } = session.user;
    const params = request.nextUrl.searchParams;

    // Extract raw query params into an object for Zod validation
    const rawQuery: Record<string, string> = {};
    const paramKeys = ["search", "action", "entityType", "from", "to", "limit", "offset"];
    for (const key of paramKeys) {
      const val = params.get(key);
      if (val !== null) {
        rawQuery[key] = val;
      }
    }

    const parsed = auditLogQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { search, action, entityType, from, to, limit, offset } = parsed.data;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Every role — INCLUDING platform_admin — is scoped to the currently
    // active organizationId. Post org-switcher, platform_admin's session
    // carries the tenant they selected via /api/platform/switch-org, so
    // dropping the legacy `role !== "platform_admin"` check closes a live
    // cross-tenant audit-log leak. If a platform_admin wants to oversee a
    // different tenant, they switch orgs in the banner. There is no path
    // to "all orgs at once" here by design. (DDIA Ch5 Replication audit.)
    where.organizationId = organizationId;

    if (action && action !== "all") {
      where.action = action;
    }

    if (entityType && entityType !== "all") {
      where.entityType = entityType;
    }

    // Date range filter
    if (from || to) {
      const createdAtFilter: Record<string, Date> = {};
      if (from) {
        createdAtFilter.gte = new Date(from);
      }
      if (to) {
        // Include the entire "to" day by setting time to end of day
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        createdAtFilter.lte = toDate;
      }
      where.createdAt = createdAtFilter;
    }

    // Search across action, entityType, entityId
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entityType: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: where as never,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where: where as never }),
    ]);

    return NextResponse.json({ logs, total, limit, offset }, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=15' },
    });
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

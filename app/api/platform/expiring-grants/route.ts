// BSRS Ch 5 P3 — expiring role grants API (list + create).
//
// GET  /api/platform/expiring-grants — list time-boxed grants in the
//      caller's organization. requireAdmin: nonprofit_admin sees their
//      own org; platform_admin sees whichever org they're currently
//      operating in via session.user.organizationId. Cross-org visibility
//      is deferred to the UI (switch-org helper already exists).
//
// POST /api/platform/expiring-grants — create a new time-boxed grant.
//      requirePlatformAdmin only. The β check in the guard catches callers
//      whose own grant has expired/been revoked since their JWT refresh.

import { errorResponse } from "@/lib/error-response";
import {
  GuardDenial,
  requireAdmin,
  requirePlatformAdmin,
} from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { createExpiringGrantSchema } from "@/lib/validations/expiring-grant";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/platform/expiring-grants:GET";
const ROUTE_POST = "api/platform/expiring-grants:POST";

// Grants expired within this window still appear on the list UI so
// admins can see recent revocations without leaving the page. Older
// expirations stay in AuditLog for the long-term trail.
const RECENTLY_EXPIRED_DAYS = 30;

export async function GET(_request: Request) {
  try {
    const { organizationId } = await requireAdmin(ROUTE_GET, "GET");

    const now = new Date();
    const recentCutoff = new Date(
      now.getTime() - RECENTLY_EXPIRED_DAYS * 24 * 60 * 60 * 1000,
    );

    // A grant is "time-boxed" iff expiresAt IS NOT NULL. We list every
    // such membership in this org — active ones and those expired/revoked
    // within the recent window.
    const grants = await prisma.organizationMembership.findMany({
      where: {
        organizationId,
        expiresAt: { not: null },
        OR: [
          { expiresAt: { gt: now }, revokedAt: null },
          { expiresAt: { gte: recentCutoff } },
          { revokedAt: { gte: recentCutoff } },
        ],
      },
      select: {
        id: true,
        role: true,
        expiresAt: true,
        grantedBy: true,
        grantReason: true,
        revokedAt: true,
        revokedBy: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { expiresAt: "asc" },
    });

    let totalActive = 0;
    let totalExpiredLast30d = 0;
    for (const g of grants) {
      const expired = g.expiresAt !== null && g.expiresAt <= now;
      const revoked = g.revokedAt !== null;
      if (!expired && !revoked) totalActive++;
      else totalExpiredLast30d++;
    }

    return NextResponse.json({ grants, totalActive, totalExpiredLast30d });
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

export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    const { userId: grantedBy, organizationId } = await requirePlatformAdmin(
      ROUTE_POST,
      "POST",
    );

    const body = await request.json().catch(() => null);
    const parsed = createExpiringGrantSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse({
        kind: "validation",
        message: "Validation failed",
        route: ROUTE_POST,
        method: "POST",
        userId: grantedBy,
        organizationId,
        extraBody: { details: parsed.error.flatten().fieldErrors },
      });
    }

    const {
      userId,
      organizationId: targetOrgId,
      role,
      expiresAt,
      grantReason,
    } = parsed.data;

    // Reject if the user already has a membership in the target org.
    // Extensions of existing grants happen on PATCH — creating a second
    // membership would violate the (userId, organizationId) unique index
    // anyway, but we return a clean 409 rather than letting Prisma throw.
    const existing = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId: targetOrgId } },
      select: { id: true },
    });
    if (existing) {
      return errorResponse({
        kind: "conflict",
        message:
          "User already has a membership in this organization. Use PATCH to extend or DELETE to revoke.",
        route: ROUTE_POST,
        method: "POST",
        userId: grantedBy,
        organizationId,
      });
    }

    const created = await prisma.organizationMembership.create({
      data: {
        userId,
        organizationId: targetOrgId,
        role,
        status: "active",
        expiresAt,
        grantedBy,
        grantReason,
      },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
        expiresAt: true,
        grantedBy: true,
        grantReason: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: grantedBy,
        organizationId: targetOrgId,
        action: "grant_expiring_role",
        entityType: "organization_membership",
        entityId: created.id,
        newValue: {
          userId,
          organizationId: targetOrgId,
          role,
          expiresAt: expiresAt.toISOString(),
          grantedBy,
          grantReason,
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof GuardDenial) return error.toErrorResponse();
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
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_POST,
      method: "POST",
      cause: error,
    });
  }
}

// BSRS Ch 5 P3 — expiring role grants API (extend + revoke).
//
// PATCH  /api/platform/expiring-grants/[id] — extend expiresAt on an
//        existing grant. requirePlatformAdmin. Adversarial posture:
//        self-extension is rejected at the route layer so the UI can't
//        be bypassed. New expiresAt is bounded by NOW + 180d (from zod),
//        not by current expiresAt + 180d.
//
// DELETE /api/platform/expiring-grants/[id] — manual revoke. Sets
//        revokedAt = now(), revokedBy = session.user.id. The next
//        session refresh will see the revocation via the α gate in
//        auth.ts. platform_admin callers also see it immediately via
//        the β gate in requirePlatformAdmin.

import { errorResponse } from "@/lib/error-response";
import { GuardDenial, requirePlatformAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { extendExpiringGrantSchema } from "@/lib/validations/expiring-grant";
import { NextResponse } from "next/server";

const ROUTE_PATCH = "api/platform/expiring-grants/[id]:PATCH";
const ROUTE_DELETE = "api/platform/expiring-grants/[id]:DELETE";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDbHealthy();
    const { userId: actingUserId, organizationId } =
      await requirePlatformAdmin(ROUTE_PATCH, "PATCH");

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = extendExpiringGrantSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse({
        kind: "validation",
        message: "Validation failed",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId: actingUserId,
        organizationId,
        extraBody: { details: parsed.error.flatten().fieldErrors },
      });
    }

    const grant = await prisma.organizationMembership.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
    if (!grant || grant.expiresAt === null) {
      return errorResponse({
        kind: "not_found",
        message: "Expiring grant not found",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId: actingUserId,
        organizationId,
      });
    }

    // Self-extension is an AUTHORITY BYPASS. A platform_admin whose own
    // grant is near expiration cannot extend it themselves — another
    // platform_admin must do it. Enforced server-side so a malicious
    // or compromised UI cannot circumvent.
    if (grant.userId === actingUserId) {
      return errorResponse({
        kind: "forbidden",
        message: "Cannot extend your own grant",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId: actingUserId,
        organizationId,
      });
    }

    if (grant.revokedAt !== null) {
      return errorResponse({
        kind: "conflict",
        message: "Cannot extend a revoked grant",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId: actingUserId,
        organizationId,
      });
    }

    const { expiresAt: newExpiresAt, extensionReason } = parsed.data;

    // expiresAt must not go backwards — an extension should extend, not
    // shorten. To shorten, revoke + re-grant (audit trail is clearer).
    if (newExpiresAt.getTime() <= grant.expiresAt.getTime()) {
      return errorResponse({
        kind: "validation",
        message: "New expiresAt must be later than the current expiresAt",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId: actingUserId,
        organizationId,
      });
    }

    const prevExpiresAt = grant.expiresAt;

    const updated = await prisma.organizationMembership.update({
      where: { id },
      data: { expiresAt: newExpiresAt },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
        expiresAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: actingUserId,
        organizationId: grant.organizationId,
        action: "extend_expiring_role",
        entityType: "organization_membership",
        entityId: id,
        oldValue: { expiresAt: prevExpiresAt.toISOString() },
        newValue: {
          expiresAt: newExpiresAt.toISOString(),
          extensionReason,
        },
      },
    });

    return NextResponse.json(updated);
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDbHealthy();
    const { userId: actingUserId, organizationId } =
      await requirePlatformAdmin(ROUTE_DELETE, "DELETE");

    const { id } = await params;

    const grant = await prisma.organizationMembership.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
    if (!grant || grant.expiresAt === null) {
      return errorResponse({
        kind: "not_found",
        message: "Expiring grant not found",
        route: ROUTE_DELETE,
        method: "DELETE",
        userId: actingUserId,
        organizationId,
      });
    }

    if (grant.revokedAt !== null) {
      return errorResponse({
        kind: "conflict",
        message: "Grant already revoked",
        route: ROUTE_DELETE,
        method: "DELETE",
        userId: actingUserId,
        organizationId,
      });
    }

    const now = new Date();
    const updated = await prisma.organizationMembership.update({
      where: { id },
      data: { revokedAt: now, revokedBy: actingUserId, status: "revoked" },
      select: {
        id: true,
        revokedAt: true,
        revokedBy: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: actingUserId,
        organizationId: grant.organizationId,
        action: "revoke_expiring_role",
        entityType: "organization_membership",
        entityId: id,
        newValue: {
          revokedAt: now.toISOString(),
          revokedBy: actingUserId,
        },
      },
    });

    return NextResponse.json(updated);
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

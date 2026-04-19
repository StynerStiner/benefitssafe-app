// MULTI-ORG SCOPED: Access control runs through OrganizationMembership.
// A team member visible in org A may belong to org B as well; the User
// row is shared but every read/write here is gated by membership in the
// caller's active org. Per-org role and status updates target the
// membership row, never the global User row.

import { auth } from "@/auth";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  jitterTtl,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ROUTE_GET = "api/users/[id]:GET";
const ROUTE_PATCH = "api/users/[id]:PATCH";
const ROUTE_DELETE = "api/users/[id]:DELETE";

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum([
    "nonprofit_admin",
    "nonprofit_staff",
    "beneficiary",
    "vendor",
    "cpa",
    "auditor",
    "attorney",
    "grant_officer",
  ]).optional(),
  phone: z.string().optional(),
});

// GET /api/users/[id] — View user profile (per-org membership scoped)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:${organizationId}:users:detail:${id}`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.LIST.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.LIST.maxStaleSeconds,
      fetcher: () => buildUserDetailResponse(organizationId, id),
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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
    console.error("GET /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function buildUserDetailResponse(organizationId: string, id: string) {
  // Multi-org access check: caller must have a membership row for this
  // user in their currently active org. Filtering by User.organizationId
  // would silently 404 multi-org team members whose User row points at
  // a different nonprofit.
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: id, organizationId },
    select: { id: true, role: true, status: true, memberCode: true },
  });
  if (!membership) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      isActive: true,
      avatarUrl: true,
      beneficiaryCode: true,
      addressCity: true,
      addressState: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  // Surface the per-org role + memberCode + membership status.
  // We never include any other-org membership data.
  return {
    ...user,
    role: membership.role,
    memberCode: membership.memberCode,
    membershipStatus: membership.status,
  };
}

// PATCH /api/users/[id] — Update team member.
//
// Role updates target the per-org OrganizationMembership row (so
// promoting Maria to "cpa" at org B does not change her role at org A).
// Other field updates (firstName, lastName, phone) write to the shared
// User row, which means they propagate across every org she belongs
// to — that's intentional for person-level attributes but worth knowing.
// Per-org overrides for these fields are out of scope for this PDR.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Only admins can edit team members" }, { status: 403 });
    }

    const { id } = await params;

    // Verify the target user is a member of THIS org via membership.
    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: id, organizationId },
      select: { id: true, role: true, status: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Per-org role update: writes to the membership row, NOT User.role.
    // User.role is the user's *most recently active* role and is mutated
    // only by /api/memberships/switch.
    if (data.role !== undefined && data.role !== membership.role) {
      await prisma.organizationMembership.update({
        where: { id: membership.id },
        data: { role: data.role },
      });
    }

    // Shared user-level fields. We only update what was provided.
    const userUpdate: Record<string, unknown> = {};
    if (data.firstName !== undefined) userUpdate.firstName = data.firstName;
    if (data.lastName !== undefined) userUpdate.lastName = data.lastName;
    if (data.phone !== undefined) userUpdate.phone = data.phone;
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id }, data: userUpdate });
    }

    const updated = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
      },
    });

    // Audit log scoped to this org. Includes per-org role if it changed.
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "update",
        entityType: "user",
        entityId: id,
        oldValue: JSON.parse(
          JSON.stringify({ ...existing, role: membership.role }),
        ),
        newValue: JSON.parse(JSON.stringify(data)),
      },
    });

    return NextResponse.json({
      ...updated,
      role: data.role ?? membership.role,
    });
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
    console.error("PATCH /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/users/[id] — Per-org soft-delete: revoke the user's
// membership in THIS org. We deliberately do NOT flip User.isActive to
// false: a multi-org user removed from one nonprofit must remain active
// at every other nonprofit they belong to. The global user is only
// deactivated as a side effect when their last active membership goes
// away (cleanup at the bottom).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Only admins can remove team members" }, { status: 403 });
    }

    const { id } = await params;

    if (id === session.user.id) {
      return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
    }

    // Locate the membership at the caller's active org.
    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: id, organizationId },
      select: { id: true, status: true, role: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Revoke this org's membership. Stay idempotent if already revoked.
    if (membership.status !== "revoked") {
      await prisma.organizationMembership.update({
        where: { id: membership.id },
        data: { status: "revoked" },
      });
    }

    // Cleanup: if the user has zero remaining active memberships across
    // the platform, also flip User.isActive=false so they can no longer
    // log in. Otherwise leave User.isActive alone — the user is still a
    // valid team member at another nonprofit.
    const remainingActive = await prisma.organizationMembership.count({
      where: { userId: id, status: "active" },
    });
    if (remainingActive === 0) {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "deactivate",
        entityType: "user",
        entityId: id,
        oldValue: JSON.parse(JSON.stringify({ membershipStatus: membership.status })),
        newValue: JSON.parse(
          JSON.stringify({
            membershipStatus: "revoked",
            globallyDeactivated: remainingActive === 0,
          }),
        ),
      },
    });

    return NextResponse.json({
      message: "User removed from organization",
      globallyDeactivated: remainingActive === 0,
    });
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
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

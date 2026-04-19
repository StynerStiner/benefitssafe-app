// DELETE /api/memberships/[id] — Revoke a user's membership from this org
// Does NOT globally deactivate the user unless they have no remaining active memberships.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { NextRequest, NextResponse } from "next/server";

const ROUTE = "api/memberships/[id]:DELETE";

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
      return NextResponse.json({ error: "Only admins can revoke memberships" }, { status: 403 });
    }

    const { id: membershipId } = await params;

    // Find the membership and verify it belongs to this org
    const membership = await prisma.organizationMembership.findFirst({
      where: { id: membershipId, organizationId },
      select: { id: true, userId: true, role: true, status: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Prevent revoking your own membership
    if (membership.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot revoke your own membership" }, { status: 400 });
    }

    // Wrap revoke + card freeze + remaining-membership count + optional
    // user deactivation + audit log in a single tx. Without this, a
    // concurrent membership create could register between the count and
    // the user deactivation, leaving us globally deactivating a user
    // who is legitimately still active elsewhere.
    //
    // Status guard on the revoke prevents a second revoke-retry from
    // producing spurious audit entries + card-freeze fan-out.
    // (DDIA Ch7 Transaction Safety audit.)
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        const revokeUpdate = await tx.organizationMembership.updateMany({
          where: { id: membershipId, organizationId, status: "active" },
          data: { status: "revoked" },
        });
        if (revokeUpdate.count === 0) {
          throw new Error("membership_not_active");
        }

        // Freeze any active virtual cards for this user in this org.
        const frozenCards = await tx.virtualCard.updateMany({
          where: {
            organizationId,
            beneficiaryId: membership.userId,
            status: "ACTIVE",
          },
          data: { status: "FROZEN" },
        });

        // Remaining active memberships (counted inside the tx so the
        // snapshot is consistent with the revoke above).
        const remainingActive = await tx.organizationMembership.count({
          where: {
            userId: membership.userId,
            status: "active",
            id: { not: membershipId },
          },
        });

        if (remainingActive === 0) {
          await tx.user.update({
            where: { id: membership.userId },
            data: { isActive: false },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            organizationId,
            action: "revoke_membership",
            entityType: "organization_membership",
            entityId: membershipId,
            newValue: {
              revokedUserId: membership.userId,
              revokedRole: membership.role,
              cardsFrozen: frozenCards.count,
              globallyDeactivated: remainingActive === 0,
            },
          },
        });

        return {
          cardsFrozen: frozenCards.count,
          globallyDeactivated: remainingActive === 0,
        };
      });
    } catch (err) {
      if ((err as Error)?.message === "membership_not_active") {
        return NextResponse.json(
          { error: "Membership is not active" },
          { status: 409 },
        );
      }
      throw err;
    }

    return NextResponse.json({
      message: "Membership revoked",
      ...result,
    });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "DELETE",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    console.error("DELETE /api/memberships/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

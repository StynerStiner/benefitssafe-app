// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { patchGrantBodySchema } from "@/lib/validations/grant";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/grants/[id]:GET";
const ROUTE_PATCH = "api/grants/[id]:PATCH";

// GET /api/grants/[id] — get single grant with categories and expenses
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse({
        kind: "unauthorized",
        message: "Unauthorized",
        route: ROUTE_GET,
        method: "GET",
      });
    }

    const { id } = await params;
    const { organizationId, role } = session.user;

    // Vendors never see grant detail — they have no business touching other
    // people's compliance rules or cards.
    if (role === "vendor") {
      return errorResponse({
        kind: "forbidden",
        message: "Forbidden",
        route: ROUTE_GET,
        method: "GET",
        userId: session.user.id,
        organizationId,
      });
    }

    const grant = await prisma.grant.findFirst({
      where: {
        id,
        organizationId,
        ...(role === "beneficiary" ? { beneficiaryId: session.user.id } : {}),
      },
      include: {
        beneficiary: { select: { id: true, firstName: true, lastName: true, email: true } },
        categories: {
          orderBy: { createdAt: "asc" },
        },
        expenses: {
          include: {
            category: { select: { id: true, name: true } },
            requestedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        virtualCards: {
          include: {
            beneficiary: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                memberships: {
                  where: { organizationId },
                  select: { memberCode: true },
                  take: 1,
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!grant) {
      return errorResponse({
        kind: "not_found",
        message: "Grant not found",
        route: ROUTE_GET,
        method: "GET",
        userId: session.user.id,
        organizationId,
      });
    }

    return NextResponse.json(grant);
  } catch (error) {
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_GET,
      method: "GET",
      cause: error,
    });
  }
}

// PATCH /api/grants/[id] — update a grant
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return errorResponse({
        kind: "unauthorized",
        message: "Unauthorized",
        route: ROUTE_PATCH,
        method: "PATCH",
      });
    }

    const { id } = await params;
    const { role, organizationId, id: userId } = session.user;

    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return errorResponse({
        kind: "forbidden",
        message: "Forbidden",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId,
        organizationId,
      });
    }

    // Pre-check org scope before opening the tx. The canonical spentAmount
    // is re-read INSIDE the tx below with SELECT FOR UPDATE so a
    // concurrent auto-approve charge cannot clobber remainingAmount.
    // (DDIA Ch7 Transaction Safety audit.)
    const exists = await prisma.grant.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!exists) {
      return errorResponse({
        kind: "not_found",
        message: "Grant not found",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId,
        organizationId,
      });
    }

    const body = await request.json();
    const parsed = patchGrantBodySchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse({
        kind: "validation",
        message: "Validation failed",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId,
        organizationId,
        extraBody: { details: parsed.error.flatten() },
      });
    }

    // `reason` is carried in the request body only for AuditLog enrichment
    // on terminal-status transitions — it is not a Grant column.
    const { reason, ...data } = parsed.data;

    // Wrap the read + recompute + update in a single tx with FOR UPDATE
    // on the grant row. Without the lock, a concurrent card-charge or
    // auto-approve tx could increment spentAmount between our read and
    // our update, causing the re-computed remainingAmount to be wrong.
    const grant = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ spentAmount: number; name: string; status: string }>
      >`
        SELECT "spentAmount", "name", "status"
        FROM "Grant"
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new Error("grant_not_found");
      }
      const currentSpent = Number(locked[0].spentAmount);

      const updateData: Record<string, unknown> = { ...data };
      if (data.totalAmount !== undefined) {
        // Recompute remaining from the locked snapshot so a concurrent
        // spent-amount increment can't produce an inconsistent result.
        updateData.remainingAmount = data.totalAmount - currentSpent;
      }
      if (data.status === "ARCHIVED") {
        updateData.archivedAt = new Date();
      }

      const updated = await tx.grant.update({
        where: { id },
        data: updateData,
        include: {
          beneficiary: { select: { id: true, firstName: true, lastName: true, email: true } },
          categories: true,
        },
      });

      // DDIA Ch7 P4 follow-up — auto-reset allowNegativeBalance when an
      // admin refill restores the balance. Guarded so the write only fires
      // on an actual true→false transition, which keeps this atomic with
      // the balance update above without producing unnecessary writes on
      // every PATCH. See docs/runbooks/stuck-overspend-grants.md for the
      // coverage gaps this does NOT close (dispute-win, off-ledger
      // reconciliation) — those still require the platform manual override.
      await tx.grant.updateMany({
        where: {
          id,
          allowNegativeBalance: true,
          remainingAmount: { gte: 0 },
        },
        data: { allowNegativeBalance: false },
      });

      await tx.auditLog.create({
        data: {
          userId,
          organizationId,
          action: "update",
          entityType: "grant",
          entityId: updated.id,
          oldValue: { name: locked[0].name, status: locked[0].status },
          newValue: {
            name: updated.name,
            status: updated.status,
            ...(reason ? { reason: reason.trim() } : {}),
          },
        },
      });

      return updated;
    });

    return NextResponse.json(grant);
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
    if ((error as Error)?.message === "grant_not_found") {
      return errorResponse({
        kind: "not_found",
        message: "Grant not found",
        route: ROUTE_PATCH,
        method: "PATCH",
      });
    }
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_PATCH,
      method: "PATCH",
      cause: error,
    });
  }
}

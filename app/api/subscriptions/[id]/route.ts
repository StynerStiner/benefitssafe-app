// ORG-SCOPED: All queries filtered by vendor.organizationId via session
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import type { SubscriptionStatus, BillingUpdateStatus } from "@/lib/generated/prisma/client";

const VALID_STATUSES: SubscriptionStatus[] = ["ACTIVE", "PAUSED", "CANCELLED"];

const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  ACTIVE: ["PAUSED", "CANCELLED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
  CANCELLED: [],
  EXPIRED: [],
};

// GET /api/subscriptions/[id] -- single subscription detail
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { organizationId } = session.user;

    const subscription = await prisma.subscription.findFirst({
      where: {
        id,
        vendor: { organizationId },
      },
      include: {
        vendor: { select: { id: true, name: true, type: true, status: true } },
        card: { select: { id: true, last4: true, status: true, cardLabel: true } },
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    return NextResponse.json(subscription);
  } catch (error) {
    console.error("GET /api/subscriptions/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/subscriptions/[id] -- update subscription status or renewalDate
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { role, organizationId, id: userId } = session.user;

    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify subscription belongs to org via vendor relation
    const existing = await prisma.subscription.findFirst({
      where: {
        id,
        vendor: { organizationId },
      },
      include: {
        vendor: { select: { id: true, name: true, organizationId: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const body = await request.json();
    const { status, renewalDate } = body as {
      status?: string;
      renewalDate?: string;
    };

    // Build update payload
    const updateData: {
      status?: SubscriptionStatus;
      renewalDate?: Date | null;
      billingUpdateStatus?: BillingUpdateStatus;
    } = {};

    const oldValues: Record<string, string | null> = {};
    const newValues: Record<string, string | null> = {};

    // Validate and apply status transition
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status as SubscriptionStatus)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }

      const currentStatus = existing.status;
      const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

      if (!allowed.includes(status as SubscriptionStatus)) {
        return NextResponse.json(
          {
            error:
              currentStatus === "CANCELLED"
                ? "Cancelled subscriptions cannot be modified"
                : `Cannot transition from ${currentStatus} to ${status}. Allowed: ${allowed.join(", ") || "none"}`,
          },
          { status: 400 }
        );
      }

      updateData.status = status as SubscriptionStatus;
      oldValues.status = currentStatus;
      newValues.status = status;

      // If cancelling, also update billingUpdateStatus
      if (status === "CANCELLED") {
        oldValues.billingUpdateStatus = existing.billingUpdateStatus;
        updateData.billingUpdateStatus = "PENDING";
        newValues.billingUpdateStatus = "PENDING";
      }
    }

    // Validate and apply renewalDate
    if (renewalDate !== undefined) {
      if (renewalDate === null) {
        updateData.renewalDate = null;
        oldValues.renewalDate = existing.renewalDate?.toISOString() ?? null;
        newValues.renewalDate = null;
      } else {
        const parsed = new Date(renewalDate);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "Invalid renewal date" },
            { status: 400 }
          );
        }
        updateData.renewalDate = parsed;
        oldValues.renewalDate = existing.renewalDate?.toISOString() ?? null;
        newValues.renewalDate = parsed.toISOString();
      }
    }

    // Nothing to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: updateData,
      include: {
        vendor: { select: { id: true, name: true, type: true, status: true } },
        card: { select: { id: true, last4: true, status: true, cardLabel: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "update",
        entityType: "subscription",
        entityId: updated.id,
        oldValue: {
          serviceName: existing.serviceName,
          ...oldValues,
        },
        newValue: {
          serviceName: updated.serviceName,
          ...newValues,
        },
      },
    });

    // Fire Composio workflow (non-blocking, fire-and-forget)
    if (status !== undefined) {
      import("@/lib/workflow-engine")
        .then(({ getWorkflowEngine }) => {
          getWorkflowEngine().fire(organizationId, "expense_approved", {
            expenseId: updated.id,
            beneficiaryName: "",
            beneficiaryEmail: "",
            amount: Number(updated.monthlyCost),
            category: "subscription",
            grantName: updated.grantId,
            approvedBy: userId,
          });
        })
        .catch(() => {});
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/subscriptions/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { NextRequest, NextResponse } from "next/server";

const ROUTE_PATCH = "api/org/workflows/[triggerId]:PATCH";
const ROUTE_DELETE = "api/org/workflows/[triggerId]:DELETE";

// PATCH /api/org/workflows/[triggerId] -- Toggle or update a workflow trigger
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 404 });
    }

    if (user.role !== "nonprofit_admin" && user.role !== "platform_admin") {
      return NextResponse.json({ error: "Only admins can manage workflows" }, { status: 403 });
    }

    const { triggerId } = await params;

    // Verify trigger belongs to this org
    const trigger = await prisma.workflowTrigger.findFirst({
      where: {
        id: triggerId,
        organizationId: user.organizationId,
      },
    });

    if (!trigger) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }

    const body = await request.json();
    const { enabled, actionConfig } = body as {
      enabled?: boolean;
      actionConfig?: Record<string, unknown>;
    };

    const updateData: { enabled?: boolean; actionConfig?: object } = {};
    if (typeof enabled === "boolean") updateData.enabled = enabled;
    if (actionConfig) updateData.actionConfig = actionConfig;

    const updated = await prisma.workflowTrigger.update({
      where: { id: triggerId },
      data: updateData,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: user.organizationId,
        action: "update",
        entityType: "workflow_trigger",
        entityId: triggerId,
        newValue: {
          action: typeof enabled === "boolean" ? (enabled ? "enabled" : "disabled") : "config_updated",
          ...updateData,
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
    console.error("PATCH /api/org/workflows/[triggerId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/org/workflows/[triggerId] -- Remove a workflow trigger
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 404 });
    }

    if (user.role !== "nonprofit_admin" && user.role !== "platform_admin") {
      return NextResponse.json({ error: "Only admins can manage workflows" }, { status: 403 });
    }

    const { triggerId } = await params;

    // Verify trigger belongs to this org
    const trigger = await prisma.workflowTrigger.findFirst({
      where: {
        id: triggerId,
        organizationId: user.organizationId,
      },
    });

    if (!trigger) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }

    await prisma.workflowTrigger.delete({
      where: { id: triggerId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: user.organizationId,
        action: "delete",
        entityType: "workflow_trigger",
        entityId: triggerId,
        newValue: {
          eventType: trigger.eventType,
          provider: trigger.provider,
          actionSlug: trigger.actionSlug,
        },
      },
    });

    return NextResponse.json({ success: true });
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
    console.error("DELETE /api/org/workflows/[triggerId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

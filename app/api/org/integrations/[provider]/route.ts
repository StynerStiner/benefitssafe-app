import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/org/integrations/[provider] -- Disconnect a provider
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
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
      return NextResponse.json({ error: "Only admins can manage integrations" }, { status: 403 });
    }

    const { provider } = await params;

    // Find and update the integration
    const integration = await prisma.integration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: user.organizationId,
          provider,
        },
      },
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    // Disconnect: update status and clear connection ID
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "disconnected",
        composioConnectionId: null,
        connectedAt: null,
      },
    });

    // Disable all workflow triggers that depend on this provider
    await prisma.workflowTrigger.updateMany({
      where: {
        organizationId: user.organizationId,
        provider,
        enabled: true,
      },
      data: { enabled: false },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: user.organizationId,
        action: "delete",
        entityType: "integration",
        entityId: integration.id,
        newValue: { provider, action: "disconnected" },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/org/integrations/[provider] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

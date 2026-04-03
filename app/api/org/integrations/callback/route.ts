import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/org/integrations/callback -- Handle OAuth callback from Composio
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get("provider");
    const integrationId = searchParams.get("integrationId");
    const connectedAccountId = searchParams.get("connectedAccountId") || searchParams.get("connection_id");
    const status = searchParams.get("status");

    if (!integrationId || !provider) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || "http://localhost:3001"}/org-settings?integration=error&message=Missing+parameters`
      );
    }

    // Find the integration
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || "http://localhost:3001"}/org-settings?integration=error&message=Integration+not+found`
      );
    }

    // Check if the connection was successful
    if (status === "failed" || status === "error") {
      await prisma.integration.update({
        where: { id: integrationId },
        data: { status: "error" },
      });

      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || "http://localhost:3001"}/org-settings?integration=error&provider=${provider}`
      );
    }

    // Update integration with Composio connection ID
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        status: "connected",
        composioConnectionId: connectedAccountId || `composio_${provider}_${Date.now()}`,
        connectedAt: new Date(),
      },
    });

    // Audit log
    if (integration.connectedBy) {
      await prisma.auditLog.create({
        data: {
          userId: integration.connectedBy,
          organizationId: integration.organizationId,
          action: "update",
          entityType: "integration",
          entityId: integrationId,
          newValue: { provider, action: "connected", connectedAccountId },
        },
      });
    }

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || "http://localhost:3001"}/org-settings?integration=success&provider=${provider}`
    );
  } catch (error) {
    console.error("GET /api/org/integrations/callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || "http://localhost:3001"}/org-settings?integration=error&message=Internal+error`
    );
  }
}

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { SUPPORTED_PROVIDERS } from "@/lib/workflow-templates";

// GET /api/org/integrations -- List org's integrations with connection status
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 404 });
    }

    const integrations = await prisma.integration.findMany({
      where: { organizationId: user.organizationId },
    });

    // Build response with all supported providers, merging stored status
    const integrationMap = new Map(
      integrations.map((i: { provider: string; id: string; status: string; connectedBy: string | null; connectedAt: Date | null; composioConnectionId: string | null }) => [
        i.provider,
        i,
      ])
    );

    const result = SUPPORTED_PROVIDERS.map((p) => {
      const stored = integrationMap.get(p.id);
      return {
        provider: p.id,
        name: p.name,
        icon: p.icon,
        status: stored?.status || "disconnected",
        connectedBy: stored?.connectedBy || null,
        connectedAt: stored?.connectedAt || null,
        composioConnectionId: stored?.composioConnectionId || null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/org/integrations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/org/integrations -- Initiate OAuth connection for a provider
export async function POST(request: Request) {
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

    const body = await request.json();
    const { provider } = body as { provider: string };

    if (!provider || !SUPPORTED_PROVIDERS.some((p) => p.id === provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    // Check if Composio is configured
    if (!process.env.COMPOSIO_API_KEY) {
      return NextResponse.json(
        { error: "Workflow automations are not configured. Contact your administrator." },
        { status: 503 }
      );
    }

    // Create or update integration record
    const integration = await prisma.integration.upsert({
      where: {
        organizationId_provider: {
          organizationId: user.organizationId,
          provider,
        },
      },
      update: {
        status: "disconnected",
        connectedBy: session.user.id,
      },
      create: {
        organizationId: user.organizationId,
        provider,
        status: "disconnected",
        connectedBy: session.user.id,
      },
    });

    // Initiate Composio OAuth connection
    const { Composio } = await import("@composio/core");
    const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

    // Map provider names to Composio toolkit names
    const toolkitMap: Record<string, string> = {
      gmail: "gmail",
      slack: "slack",
      google_calendar: "googlecalendar",
      google_sheets: "googlesheets",
      asana: "asana",
      trello: "trello",
    };

    const toolkit = toolkitMap[provider] || provider;
    const callbackUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3001"}/api/org/integrations/callback?provider=${provider}&integrationId=${integration.id}`;

    // Create a session and authorize the toolkit via OAuth
    const composioSession = await composio.create(user.organizationId);
    const connectionRequest = await composioSession.authorize(toolkit, {
      callbackUrl,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: user.organizationId,
        action: "create",
        entityType: "integration",
        entityId: integration.id,
        newValue: { provider, action: "connection_initiated" },
      },
    });

    // Store the Composio connection ID for tracking
    await prisma.integration.update({
      where: { id: integration.id },
      data: { composioConnectionId: connectionRequest.id },
    });

    return NextResponse.json({
      url: connectionRequest.redirectUrl,
      integrationId: integration.id,
    });
  } catch (error) {
    console.error("POST /api/org/integrations error:", error);
    return NextResponse.json({ error: "Failed to initiate connection" }, { status: 500 });
  }
}

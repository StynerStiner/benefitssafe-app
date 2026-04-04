import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { WORKFLOW_TEMPLATES, getTemplateById } from "@/lib/workflow-templates";
import type { Prisma } from "@/lib/generated/prisma/client";

// GET /api/org/workflows -- List org's workflow triggers with template info
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

    // Get org's active triggers
    const triggers = await prisma.workflowTrigger.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
    });

    // Get org's connected integrations for provider status
    const integrations = await prisma.integration.findMany({
      where: { organizationId: user.organizationId },
    });

    const connectedProviders = new Set(
      integrations
        .filter((i: { status: string }) => i.status === "connected")
        .map((i: { provider: string }) => i.provider)
    );

    // Build trigger map by template ID for quick lookup
    const triggerMap = new Map(
      triggers.map((t: { actionSlug: string; eventType: string; id: string; enabled: boolean; actionConfig: unknown }) => [
        `${t.eventType}:${t.actionSlug}`,
        t,
      ])
    );

    // Merge templates with org-specific trigger status
    const result = WORKFLOW_TEMPLATES.map((template) => {
      const key = `${template.eventType}:${template.actionSlug}`;
      const trigger = triggerMap.get(key);
      return {
        ...template,
        triggerId: trigger?.id || null,
        enabled: trigger?.enabled || false,
        providerConnected: connectedProviders.has(template.provider),
        actionConfig: trigger?.actionConfig || template.actionConfig,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/org/workflows error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/org/workflows -- Create a workflow trigger from a template
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
      return NextResponse.json({ error: "Only admins can manage workflows" }, { status: 403 });
    }

    const body = await request.json();
    const { templateId, actionConfig } = body as {
      templateId: string;
      actionConfig?: Record<string, unknown>;
    };

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const template = getTemplateById(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Check if provider is connected
    const integration = await prisma.integration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: user.organizationId,
          provider: template.provider,
        },
      },
    });

    if (!integration || integration.status !== "connected") {
      return NextResponse.json(
        { error: `${template.provider} is not connected. Connect it first in Integrations.` },
        { status: 400 }
      );
    }

    // Create the trigger
    const trigger = await prisma.workflowTrigger.create({
      data: {
        organizationId: user.organizationId,
        eventType: template.eventType,
        provider: template.provider,
        actionSlug: template.actionSlug,
        actionConfig: (actionConfig || template.actionConfig) as Prisma.InputJsonValue,
        enabled: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: user.organizationId,
        action: "create",
        entityType: "workflow_trigger",
        entityId: trigger.id,
        newValue: {
          templateId,
          eventType: template.eventType,
          provider: template.provider,
          actionSlug: template.actionSlug,
        },
      },
    });

    return NextResponse.json(trigger, { status: 201 });
  } catch (error) {
    console.error("POST /api/org/workflows error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

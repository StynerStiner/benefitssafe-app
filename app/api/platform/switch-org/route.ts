// POST /api/platform/switch-org — Platform-admin org selector backend.
//
// The platform admin nav spreads the nonprofit nav (Dashboard, Grants,
// Beneficiaries, etc.) but every page and API route filters by
// session.user.organizationId. Until this endpoint existed, a platform
// admin's session was pinned to the BenefitsSafe platform org (ORG-00001),
// which has no tenant data — so every page rendered empty. This route
// lets a platform admin temporarily re-pin their session to any tenant
// org for oversight.
//
// Semantics:
//   - Mutates User.organizationId on the platform admin's own row.
//   - Intentionally does NOT touch User.role — a platform admin stays
//     platform_admin regardless of which tenant they are viewing, so
//     role-gated routes keep working.
//   - Client must follow up with useSession().update({ refreshOrg: true })
//     so the JWT re-reads the new org name/billing state.
//   - Every switch is audit-logged AGAINST THE TARGET ORG so that org's
//     own audit trail also shows platform-level access.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const organizationId =
      body && typeof body.organizationId === "string" ? body.organizationId : "";
    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, orgCode: true, isPlatformOrg: true },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Re-pin the platform admin's active org. Role stays platform_admin.
    await prisma.user.update({
      where: { id: session.user.id },
      data: { organizationId: org.id },
    });

    // Audit log the switch against the TARGET org so the tenant nonprofit's
    // own audit trail records the platform-level access event. Using the
    // target org (not the platform org) means a nonprofit auditor reviewing
    // their own audit trail will see every time internal staff looked at
    // their data — important for trust and SOC 2 access review.
    //
    // DDIA Ch7 Transaction Safety audit removed the previous
    // `.catch(() => {})` that silently swallowed errors here. A
    // cross-tenant access event that fails to persist its audit log is a
    // SOC 2 finding; letting the error propagate to the outer 500 so the
    // client retries is the correct behavior.
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: org.id,
        action: "platform_admin_switch_org",
        entityType: "organization",
        entityId: org.id,
        newValue: {
          orgName: org.name,
          orgCode: org.orgCode,
          isPlatformOrg: org.isPlatformOrg,
        },
      },
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        orgCode: org.orgCode,
        isPlatformOrg: org.isPlatformOrg,
      },
    });
  } catch (error) {
    console.error("POST /api/platform/switch-org error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

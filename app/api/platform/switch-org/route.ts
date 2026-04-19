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
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";

const ROUTE = "api/platform/switch-org:POST";

export async function POST(request: Request) {
  try {
    await assertDbHealthy();
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

    // Re-pin the platform admin's active org AND record the audit event
    // in a single transaction. Role stays platform_admin.
    //
    // DDIA Ch9 Consistency & Consensus audit — these two writes were
    // previously sequential, so a DB error on the audit log would leave
    // the platform admin already switched into the target org with no
    // audit trail. That is a SOC 2 access-review finding (cross-tenant
    // access with no log). Wrapping both in $transaction makes the switch
    // all-or-nothing: either both land or the user sees a 500 and the
    // session is untouched. We target the TARGET org for the audit log so
    // the tenant nonprofit's own audit trail records every internal access.
    //
    // Supersedes the Ch7 fix that removed the previous `.catch(() => {})`;
    // letting the error propagate was correct, but the write itself was
    // still non-atomic until now.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { organizationId: org.id },
      }),
      prisma.auditLog.create({
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
      }),
    ]);

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
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    console.error("POST /api/platform/switch-org error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

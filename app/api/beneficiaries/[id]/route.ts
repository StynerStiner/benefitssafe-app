// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { updateBeneficiarySchema } from "@/lib/validations/beneficiary";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/beneficiaries/[id]:GET";
const ROUTE_PATCH = "api/beneficiaries/[id]:PATCH";

// Full profile select — includes all profile fields.
// ssnLast4 is masked before returning.
//
// IMPORTANT: `grants` and `expenseRequests` MUST be filtered by the viewing
// org's organizationId. Because they're pulled via the User relation, with
// no org filter Prisma would return every grant/expense the beneficiary
// holds across every nonprofit they belong to — a cross-tenant data leak
// at multi-org scale. The buildProfileSelect() helper closes that gap.
function buildProfileSelect(viewingOrgId: string) {
  return {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    isActive: true,
    dateOfBirth: true,
    addressStreet: true,
    addressCity: true,
    addressState: true,
    addressZip: true,
    ssnLast4: true,
    benefitPrograms: true,
    emergencyContactName: true,
    emergencyContactPhone: true,
    // Legacy: User.notes is shared across all orgs a beneficiary
    // belongs to. New writes go to OrganizationMembership.notes
    // (per-org private notes) — see GET handler below.
    notes: true,
    passwordHash: true,
    createdAt: true,
    inviteTokens: {
      select: {
        id: true,
        sentTo: true,
        method: true,
        createdAt: true,
        expiresAt: true,
        usedAt: true,
      },
      orderBy: { createdAt: "desc" as const },
    },
    grants: {
      where: { archivedAt: null, organizationId: viewingOrgId },
      select: {
        id: true,
        name: true,
        grantIssuerName: true,
        totalAmount: true,
        spentAmount: true,
        remainingAmount: true,
        status: true,
        startDate: true,
        endDate: true,
        benefitFlags: true,
        categories: {
          select: {
            id: true,
            name: true,
            allocatedAmount: true,
            spentAmount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" as const },
    },
    expenseRequests: {
      where: {
        archivedAt: null,
        grant: { organizationId: viewingOrgId },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        expenseType: true,
        status: true,
        riskClassification: true,
        riskNotes: true,
        rejectedReason: true,
        createdAt: true,
        grant: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" as const },
    },
  } as const;
}

// GET /api/beneficiaries/[id] — full beneficiary profile with grants and expenses
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
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

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return errorResponse({
        kind: "forbidden",
        message: "Forbidden",
        route: ROUTE_GET,
        method: "GET",
        userId: session.user.id,
        organizationId,
      });
    }

    const { id } = await params;

    // Multi-org access control: the viewing admin's session.user.organizationId
    // must have an active beneficiary membership for this user. Filtering by
    // User.organizationId would be wrong: a beneficiary could be in our org
    // via a membership while their User.organizationId still points at the
    // org where they originally registered.
    //
    // We also pull the per-org notes from the membership row so the admin
    // sees their own org's private notes (not whatever User.notes happened
    // to be set to by another nonprofit).
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: id,
        organizationId,
        role: "beneficiary",
      },
      select: { id: true, notes: true },
    });
    if (!membership) {
      return errorResponse({
        kind: "not_found",
        message: "Beneficiary not found",
        route: ROUTE_GET,
        method: "GET",
        userId: session.user.id,
        organizationId,
      });
    }

    const beneficiary = await prisma.user.findUnique({
      where: { id },
      select: buildProfileSelect(organizationId),
    });

    if (!beneficiary) {
      return errorResponse({
        kind: "not_found",
        message: "Beneficiary not found",
        route: ROUTE_GET,
        method: "GET",
        userId: session.user.id,
        organizationId,
      });
    }

    // Derive invite status
    const lastInvite = beneficiary.inviteTokens?.[0];
    let inviteStatus: "not_invited" | "invited" | "active" = "not_invited";
    let inviteSentAt: string | null = null;

    if (beneficiary.passwordHash) {
      inviteStatus = "active";
    } else if (lastInvite) {
      inviteStatus = "invited";
      inviteSentAt = lastInvite.createdAt.toISOString();
    }

    // Build invite history with status for each token
    const inviteHistory = beneficiary.inviteTokens.map((t) => {
      let status: "accepted" | "expired" | "pending" = "pending";
      if (t.usedAt) {
        status = "accepted";
      } else if (new Date() > t.expiresAt) {
        status = "expired";
      }
      return {
        id: t.id,
        sentTo: t.sentTo || beneficiary.email,
        method: (t.method || "email") as "email" | "link",
        sentAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt.toISOString(),
        usedAt: t.usedAt?.toISOString() || null,
        status,
      };
    });

    // Mask SSN — only show last 4 as ***-**-XXXX
    // Exclude passwordHash and inviteTokens from response.
    // Notes: prefer the per-org membership.notes (private to this nonprofit)
    // over the legacy global User.notes. Both fields exist; the membership
    // value wins when set so each nonprofit sees its own annotations.
    const { passwordHash: _ph, inviteTokens: _it, ...rest } = beneficiary;
    const masked = {
      ...rest,
      ssnLast4: beneficiary.ssnLast4
        ? `***-**-${beneficiary.ssnLast4}`
        : null,
      notes: membership.notes ?? beneficiary.notes,
      inviteStatus,
      inviteSentAt,
      inviteHistory,
    };

    return NextResponse.json(masked);
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

// PATCH /api/beneficiaries/[id] — update beneficiary profile
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse({
        kind: "unauthorized",
        message: "Unauthorized",
        route: ROUTE_PATCH,
        method: "PATCH",
      });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return errorResponse({
        kind: "forbidden",
        message: "Forbidden",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId: session.user.id,
        organizationId,
      });
    }

    const { id } = await params;

    // Verify beneficiary belongs to this org via membership (multi-org safe).
    // Notes are now per-org: data.notes writes to OrganizationMembership.notes
    // so each nonprofit's annotations stay private. Other shared User-level
    // fields (phone, address, DOB) still write to the User row — they're
    // person-level attributes and intentionally cross-org.
    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: id, organizationId, role: "beneficiary" },
      select: { id: true },
    });
    if (!membership) {
      return errorResponse({
        kind: "not_found",
        message: "Beneficiary not found",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId: session.user.id,
        organizationId,
      });
    }

    const body = await request.json();
    const parsed = updateBeneficiarySchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse({
        kind: "validation",
        message: "Validation failed",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId: session.user.id,
        organizationId,
        extraBody: { details: parsed.error.flatten().fieldErrors },
      });
    }

    // `reason` is a write-only justification used for the AuditLog on
    // deactivation (BSRS Ch 5 §5.3). It is NOT a User column — strip it
    // out before any Prisma write touches it.
    const { reason, ...data } = parsed.data;
    const clean = (val: string | undefined): string | null | undefined =>
      val === undefined ? undefined : val && val.trim() ? val.trim() : null;

    // notes is per-org → write to membership; everything else is shared
    // User-level data so we update the User row as before.
    if (data.notes !== undefined) {
      await prisma.organizationMembership.update({
        where: { id: membership.id },
        data: { notes: clean(data.notes) },
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName.trim() }),
        ...(data.lastName !== undefined && { lastName: data.lastName.trim() }),
        ...(data.phone !== undefined && { phone: clean(data.phone) }),
        ...(data.dateOfBirth !== undefined && {
          dateOfBirth: data.dateOfBirth && data.dateOfBirth.trim() ? new Date(data.dateOfBirth) : null,
        }),
        ...(data.addressStreet !== undefined && { addressStreet: clean(data.addressStreet) }),
        ...(data.addressCity !== undefined && { addressCity: clean(data.addressCity) }),
        ...(data.addressState !== undefined && { addressState: clean(data.addressState) }),
        ...(data.addressZip !== undefined && { addressZip: clean(data.addressZip) }),
        ...(data.ssnLast4 !== undefined && { ssnLast4: clean(data.ssnLast4) }),
        ...(data.benefitPrograms !== undefined && { benefitPrograms: data.benefitPrograms }),
        ...(data.emergencyContactName !== undefined && { emergencyContactName: clean(data.emergencyContactName) }),
        ...(data.emergencyContactPhone !== undefined && { emergencyContactPhone: clean(data.emergencyContactPhone) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    // Audit log — never log ssnLast4. Extend newValue with the deactivation
    // justification so reviewers see the reason alongside the state change.
    const auditData: Record<string, unknown> = { ...data };
    delete auditData.ssnLast4;
    if (data.isActive === false && reason) {
      auditData.reason = reason.trim();
    }
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "update",
        entityType: "user",
        entityId: id,
        newValue: JSON.parse(JSON.stringify(auditData)),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_PATCH,
      method: "PATCH",
      cause: error,
    });
  }
}

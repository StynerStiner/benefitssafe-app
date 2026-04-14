// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateBeneficiarySchema } from "@/lib/validations/beneficiary";
import { NextResponse } from "next/server";

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
    // KNOWN LIMITATION: User.notes is currently shared across all orgs
    // a beneficiary belongs to. Per-org notes need to live on
    // OrganizationMembership in a follow-up PDR.
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Multi-org access control: the viewing admin's session.user.organizationId
    // must have an active beneficiary membership for this user. Filtering by
    // User.organizationId would be wrong: a beneficiary could be in our org
    // via a membership while their User.organizationId still points at the
    // org where they originally registered.
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: id,
        organizationId,
        role: "beneficiary",
      },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "Beneficiary not found" },
        { status: 404 },
      );
    }

    const beneficiary = await prisma.user.findUnique({
      where: { id },
      select: buildProfileSelect(organizationId),
    });

    if (!beneficiary) {
      return NextResponse.json(
        { error: "Beneficiary not found" },
        { status: 404 },
      );
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
    // Exclude passwordHash and inviteTokens from response
    const { passwordHash: _ph, inviteTokens: _it, ...rest } = beneficiary;
    const masked = {
      ...rest,
      ssnLast4: beneficiary.ssnLast4
        ? `***-**-${beneficiary.ssnLast4}`
        : null,
      inviteStatus,
      inviteSentAt,
      inviteHistory,
    };

    return NextResponse.json(masked);
  } catch (error) {
    console.error("GET /api/beneficiaries/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify beneficiary belongs to this org via membership (multi-org safe).
    // KNOWN LIMITATION: this PATCH still writes to the User row, so updates
    // to phone/address/notes propagate to every other nonprofit that has
    // this user as a beneficiary. Per-org overrides are out of scope for
    // this PDR — see `notes` comment in buildProfileSelect.
    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: id, organizationId, role: "beneficiary" },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "Beneficiary not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = updateBeneficiarySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const clean = (val: string | undefined): string | null | undefined =>
      val === undefined ? undefined : val && val.trim() ? val.trim() : null;

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
        ...(data.notes !== undefined && { notes: clean(data.notes) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    // Audit log — never log ssnLast4
    const auditData = { ...data };
    delete (auditData as Record<string, unknown>).ssnLast4;
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
    console.error("PATCH /api/beneficiaries/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PLATFORM-ADMIN ONLY: Internal staff management.
//
// GET  /api/platform/internal-staff           — list all BenefitsSafe internal
//                                                staff (cross-org by design)
// POST /api/platform/internal-staff           — create a new internal staff user,
//                                                generate an InviteToken, and
//                                                email a set-password link.
//
// Internal staff = anyone whose role is in PLATFORM_INVITABLE_ROLES:
//   platform_admin, compliance_officer, support_agent, billing_admin.
//
// These roles operate on behalf of BenefitsSafe and are NOT invitable by
// nonprofit_admin. Every other role (beneficiary, vendor, etc.) goes
// through /api/invite or /api/beneficiaries — never this route.
//
// Org scoping: the new staff member is assigned to the Organization row
// flagged Organization.isPlatformOrg = true. The platform org is a
// schema-enforced invariant — there is exactly one row, and internal staff
// are always created under it regardless of which platform org the
// inviting admin happens to sit in. If a platform_admin is found outside
// the platform org we log a warning so it gets fixed, but we still create
// the new staff member under the canonical platform org.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  PLATFORM_INVITABLE_ROLES,
  isPlatformInvitableRole,
} from "@/lib/constants/invitable-roles";
import {
  validateRecipientEmail,
  sanitizeEmailForLog,
  buildSecureLink,
} from "@/lib/email-security";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/services/email-service";
import { buildInviteEmail } from "@/lib/services/email-templates";
import { generateMembershipCode } from "@/lib/utils/membership-code";
import type { UserRole } from "@/lib/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const INVITE_EXPIRY_DAYS = 7;

// Resolve the canonical platform Organization row. There is exactly one
// (Organization.isPlatformOrg = true). Returns null if missing — callers
// should treat that as a hard configuration error.
async function getPlatformOrg(): Promise<{ id: string; name: string } | null> {
  return prisma.organization.findFirst({
    where: { isPlatformOrg: true },
    select: { id: true, name: true },
  });
}

// GET /api/platform/internal-staff
//
// Lists internal staff that live in the platform org. We deliberately do
// NOT show staff scattered across tenant orgs — those represent broken
// state and should be surfaced separately (TODO: a "drift" report).
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const platformOrg = await getPlatformOrg();
    if (!platformOrg) {
      return NextResponse.json(
        { error: "Platform organization not configured" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 50 : rawLimit, 1), 200);
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

    const roleFilter = searchParams.get("role");
    const search = searchParams.get("search")?.trim() || "";

    // Scope strictly to the platform org so a stray platform_admin seeded
    // into a tenant nonprofit never appears in this list.
    const where: Record<string, unknown> = {
      organizationId: platformOrg.id,
      role: { in: PLATFORM_INVITABLE_ROLES as readonly UserRole[] },
    };

    if (roleFilter && isPlatformInvitableRole(roleFilter)) {
      where.role = roleFilter as UserRole;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [staff, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          passwordHash: true,
          lastLoginAt: true,
          createdAt: true,
          organizationId: true,
          organization: { select: { name: true, orgCode: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    // Don't expose the actual password hash — just whether one is set.
    const sanitized = staff.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      isActive: u.isActive,
      hasPassword: !!u.passwordHash,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      organization: u.organization,
    }));

    return NextResponse.json({ staff: sanitized, total, limit, offset });
  } catch (error) {
    console.error("GET /api/platform/internal-staff error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/platform/internal-staff
//
// Body: { email, firstName, lastName, role }
//   role MUST be in PLATFORM_INVITABLE_ROLES.
//
// Creates the User row + OrganizationMembership(pending) + InviteToken,
// emails the invite, and audit-logs the entire operation.
const createStaffSchema = z.object({
  email: z.string().email().max(254),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum([
    "platform_admin",
    "compliance_officer",
    "support_agent",
    "billing_admin",
  ]),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limitResult = rateLimit(
      `internal-staff-create:${session.user.id}`,
      RATE_LIMIT_CONFIGS.beneficiaryCreate,
    );
    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = createStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { email, firstName, lastName, role } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const emailCheck = validateRecipientEmail(normalizedEmail);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.reason || "Invalid email address" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    // Resolve the canonical BenefitsSafe platform org. We deliberately do
    // NOT trust the inviting admin's organizationId — a platform_admin
    // accidentally seeded into a tenant nonprofit must never be allowed
    // to manufacture more internal staff under that nonprofit.
    const platformOrg = await prisma.organization.findFirst({
      where: { isPlatformOrg: true },
      select: { id: true, name: true },
    });
    if (!platformOrg) {
      return NextResponse.json(
        { error: "Platform organization not configured" },
        { status: 500 },
      );
    }

    // Invariant warning: log (don't block) when a platform_admin lives
    // outside the canonical platform org. Surfaces drift without breaking
    // the invite flow.
    if (session.user.organizationId !== platformOrg.id) {
      console.warn(
        `[internal-staff] platform_admin ${session.user.id} is in org ${session.user.organizationId} but platform org is ${platformOrg.id}. Invite will still be created in the platform org.`,
      );
    }

    const organizationId = platformOrg.id;
    const org = { name: platformOrg.name };

    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + INVITE_EXPIRY_DAYS);

    // Create user, membership, and invite token together. We deliberately
    // start the user as inactive — accept-invite flips isActive=true after
    // they set their password, so an unanswered invite cannot log in.
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role,
          organizationId,
          isActive: false,
          emailVerified: true, // platform_admin is vouching for this address
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      const memberCode = await generateMembershipCode(tx, organizationId, role);

      await tx.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId,
          role,
          memberCode,
          status: "pending",
          invitedBy: session.user.id,
          isDefaultOrg: true,
        },
      });

      const invite = await tx.inviteToken.create({
        data: {
          userId: user.id,
          sentTo: user.email,
          method: "email",
          sentById: session.user.id,
          expiresAt: tokenExpiresAt,
        },
        select: { id: true, token: true, expiresAt: true },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId,
          action: "internal_staff_invite",
          entityType: "user",
          entityId: user.id,
          newValue: {
            invitedEmail: sanitizeEmailForLog(user.email),
            invitedRole: user.role,
            inviteTokenId: invite.id,
            expiresAt: invite.expiresAt.toISOString(),
          },
        },
      });

      return { user, invite, memberCode };
    });

    const inviteUrl = buildSecureLink(
      `/auth/accept-invite?token=${result.invite.token}`,
    );

    // Fire the invite email. Failures are logged inside sendEmail; we still
    // return success because the platform_admin can copy the invite link
    // from the response if email delivery fails.
    const inviteEmail = buildInviteEmail({
      firstName: result.user.firstName,
      orgName: org.name,
      inviteUrl,
      loginEmail: result.user.email,
      expiresDays: INVITE_EXPIRY_DAYS,
      role: result.user.role,
    });
    const sendResult = await sendEmail({
      to: result.user.email,
      subject: inviteEmail.subject,
      html: inviteEmail.html,
      text: inviteEmail.text,
      orgName: org.name,
      userId: session.user.id,
      organizationId,
      emailType: "invite",
    });

    return NextResponse.json(
      {
        message: "Internal staff invited",
        user: result.user,
        memberCode: result.memberCode,
        inviteUrl,
        emailSent: sendResult.sent || sendResult.skipped,
        expiresAt: result.invite.expiresAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/platform/internal-staff error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

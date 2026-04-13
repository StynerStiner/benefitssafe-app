// POST /api/users/invite — Invite a new team member by email + role
// Creates User record, sends invite via existing invite system

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { validateRecipientEmail, sanitizeEmailForLog, buildSecureLink } from "@/lib/email-security";
import { checkLimitAccess, buildLimitReachedResponse } from "@/lib/feature-gates";
import { sendEmail } from "@/lib/services/email-service";
import { buildInviteEmail } from "@/lib/services/email-templates";
import { generateMembershipCode } from "@/lib/utils/membership-code";
import { NextResponse } from "next/server";
import { z } from "zod";

const INVITABLE_ROLES = [
  "nonprofit_staff",
  "cpa",
  "auditor",
  "attorney",
  "grant_officer",
];

const inviteSchema = z.object({
  email: z.string().email("Valid email required"),
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  role: z.enum(INVITABLE_ROLES as [string, ...string[]], {
    required_error: "Role is required",
  }),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Only admins can invite team members" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { email, firstName, lastName, role: inviteRole } = parsed.data;

    // Plan limit gate: count active team members (non-beneficiary, non-vendor roles)
    const currentTeamCount = await prisma.user.count({
      where: {
        organizationId,
        isActive: true,
        role: { notIn: ["beneficiary", "vendor"] },
      },
    });
    const teamLimitCheck = await checkLimitAccess(
      organizationId,
      "maxTeamMembers",
      currentTeamCount,
    );
    if (!teamLimitCheck.allowed) {
      return NextResponse.json(
        buildLimitReachedResponse("maxTeamMembers", teamLimitCheck),
        { status: 403 },
      );
    }

    // Validate recipient email against disposable domains and injection attacks
    const emailCheck = validateRecipientEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.reason || "Invalid email address" },
        { status: 400 },
      );
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, organizationId: true },
    });

    if (existing) {
      if (existing.organizationId === organizationId) {
        return NextResponse.json(
          { error: "This email is already a member of your organization" },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "This email is already registered with another organization" },
        { status: 409 },
      );
    }

    // Create user record (no password -- they'll set it via invite)
    const newUser = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        role: inviteRole as never,
        organizationId,
        isActive: true,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    // Generate TM-/BS-/VN- memberCode based on inviteRole via shared utility
    const memberCode = await generateMembershipCode(prisma, organizationId, inviteRole);

    // Create OrganizationMembership with "pending" status
    await prisma.organizationMembership.create({
      data: {
        userId: newUser.id,
        organizationId,
        role: inviteRole,
        memberCode,
        status: "pending",
        invitedBy: session.user.id,
        isDefaultOrg: true,
      },
    });

    // Create invite token (7-day expiry)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await prisma.inviteToken.create({
      data: {
        userId: newUser.id,
        sentTo: email,
        method: "email",
        sentById: session.user.id,
        expiresAt,
      },
      select: { token: true, expiresAt: true },
    });

    const inviteUrl = buildSecureLink(`/auth/accept-invite?token=${invite.token}`);

    // Centralized invite email via email-service.
    const inviteEmailContent = buildInviteEmail({
      firstName,
      orgName: session.user.organizationName,
      inviteUrl,
      loginEmail: email,
      expiresDays: 7,
      role: inviteRole,
    });
    const sendResult = await sendEmail({
      to: email,
      subject: inviteEmailContent.subject,
      html: inviteEmailContent.html,
      text: inviteEmailContent.text,
      orgName: session.user.organizationName,
      userId: session.user.id,
      organizationId,
      emailType: "invite",
    });
    const emailSent = sendResult.sent || sendResult.skipped;

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "invite",
        entityType: "user",
        entityId: newUser.id,
        newValue: JSON.parse(JSON.stringify({
          email: sanitizeEmailForLog(email),
          role: inviteRole,
          firstName,
          lastName,
          emailSent,
        })),
      },
    });

    return NextResponse.json({
      message: "Team member invited",
      user: newUser,
      inviteUrl,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/users/invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

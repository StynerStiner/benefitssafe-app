// POST /api/invite — Send or generate an invite for any user in the organization
// Generic invite endpoint: works for beneficiary, nonprofit_staff, vendor, cpa, auditor, attorney, grant_officer
//
// Body params:
//   userId: string (required)
//   mode: "send_email" | "generate_link" (default: "send_email")
//   overrideEmail: string (optional — send invite to a different email address)

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import {
  ORG_INVITABLE_ROLES,
  PLATFORM_INVITABLE_ROLES,
  isPlatformInvitableRole,
  isOrgInvitableRole,
} from "@/lib/constants/invitable-roles";
import { validateRecipientEmail, sanitizeEmailForLog, buildSecureLink } from "@/lib/email-security";
import { errorResponse } from "@/lib/error-response";
import { sendEmail } from "@/lib/services/email-service";
import { buildInviteEmail } from "@/lib/services/email-templates";
import { NextResponse } from "next/server";

const ROUTE = "api/invite:POST";

const INVITE_EXPIRY_DAYS = 7;

// Invitable roles split by who is allowed to invite them. nonprofit_admin
// can invite ORG roles only; platform_admin can invite both. Anyone trying
// to invite a PLATFORM role from outside platform_admin is rejected.
const ALL_INVITABLE_ROLES = [
  ...ORG_INVITABLE_ROLES,
  ...PLATFORM_INVITABLE_ROLES,
];

export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, mode = "send_email", overrideEmail } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // For platform_admin re-inviting an existing internal staff user, we
    // skip the org-membership filter — internal staff may sit in a different
    // platform org than the inviting platform_admin. nonprofit_admin is
    // always restricted to their own org's users.
    const isPlatformCaller = role === "platform_admin";

    // Validate overrideEmail if provided
    if (overrideEmail) {
      const emailCheck = validateRecipientEmail(overrideEmail);
      if (!emailCheck.valid) {
        return NextResponse.json({ error: emailCheck.reason || "Invalid email address" }, { status: 400 });
      }
    }

    // Verify the user exists and has an invitable role. nonprofit_admin
    // callers are constrained to their own org; platform_admin can invite
    // any user across orgs (needed for cross-org internal staff).
    const user = await prisma.user.findFirst({
      where: isPlatformCaller
        ? { id: userId }
        : { id: userId, organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        role: true,
        organizationId: true,
        passwordHash: true,
        organization: { select: { name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!(ALL_INVITABLE_ROLES as readonly string[]).includes(user.role)) {
      return NextResponse.json(
        { error: `Cannot invite users with role: ${user.role}` },
        { status: 400 },
      );
    }

    // Critical permission check: only platform_admin may (re-)invite users
    // whose role is in PLATFORM_INVITABLE_ROLES. A nonprofit_admin trying
    // to invite a platform_admin / compliance_officer / support_agent /
    // billing_admin — even one already seeded inside their own org — must
    // get a 403, since those roles operate on behalf of BenefitsSafe and
    // must never be manufactured by tenant admins.
    if (isPlatformInvitableRole(user.role) && !isPlatformCaller) {
      return NextResponse.json(
        { error: "Only platform_admin can invite internal staff roles" },
        { status: 403 },
      );
    }
    // And nonprofit_admin can only invite ORG_INVITABLE_ROLES (defense in
    // depth — already covered by the check above, but make it explicit).
    if (!isPlatformCaller && !isOrgInvitableRole(user.role)) {
      return NextResponse.json(
        { error: "Forbidden role for non-platform inviter" },
        { status: 403 },
      );
    }

    if (user.passwordHash) {
      return NextResponse.json(
        { error: "This user already has an account set up" },
        { status: 409 },
      );
    }

    // If overrideEmail provided, update the user's email first
    if (overrideEmail && overrideEmail !== user.email) {
      // Check email isn't already taken
      const emailTaken = await prisma.user.findUnique({
        where: { email: overrideEmail },
        select: { id: true },
      });
      if (emailTaken && emailTaken.id !== user.id) {
        return NextResponse.json(
          { error: "This email is already in use by another account" },
          { status: 409 },
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { email: overrideEmail },
      });

      // Audit the email change
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId,
          action: "update",
          entityType: "user",
          entityId: user.id,
          oldValue: JSON.parse(JSON.stringify({ email: user.email })),
          newValue: JSON.parse(JSON.stringify({ email: overrideEmail })),
        },
      });

      // Use the new email going forward
      user.email = overrideEmail;
    }

    // Invalidate any existing unused tokens for this user
    await prisma.inviteToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        expiresAt: new Date(0),
      },
    });

    // Create new invite token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invite = await prisma.inviteToken.create({
      data: {
        userId: user.id,
        sentTo: user.email,
        method: mode === "generate_link" ? "link" : "email",
        sentById: session.user.id,
        expiresAt,
      },
      select: {
        id: true,
        token: true,
        expiresAt: true,
      },
    });

    const inviteUrl = buildSecureLink(`/auth/accept-invite?token=${invite.token}`);

    let emailSent = false;

    // Only send email if mode is send_email
    if (mode === "send_email") {
      // Validate recipient email before sending
      const recipientCheck = validateRecipientEmail(user.email);
      if (!recipientCheck.valid) {
        return NextResponse.json(
          { error: recipientCheck.reason || "Invalid recipient email" },
          { status: 400 },
        );
      }

      const inviteEmailContent = buildInviteEmail({
        firstName: user.firstName,
        orgName: user.organization.name,
        inviteUrl,
        loginEmail: user.email,
        expiresDays: INVITE_EXPIRY_DAYS,
        role: user.role,
      });
      const inviteSendResult = await sendEmail({
        to: user.email,
        subject: inviteEmailContent.subject,
        html: inviteEmailContent.html,
        text: inviteEmailContent.text,
        orgName: user.organization.name,
        userId: session.user.id,
        organizationId,
        emailType: "invite",
      });
      emailSent = inviteSendResult.sent || inviteSendResult.skipped;
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "invite",
        entityType: "user",
        entityId: user.id,
        newValue: JSON.parse(JSON.stringify({
          invitedEmail: sanitizeEmailForLog(user.email),
          invitedRole: user.role,
          mode,
          emailSent,
          expiresAt: invite.expiresAt,
        })),
      },
    });

    return NextResponse.json({
      message: mode === "generate_link" ? "Invite link generated" : "Invite sent",
      inviteUrl,
      email: user.email,
      expiresAt: invite.expiresAt,
      emailSent,
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
    console.error("POST /api/invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}


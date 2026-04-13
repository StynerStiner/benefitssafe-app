// POST /api/invite — Send or generate an invite for any user in the organization
// Generic invite endpoint: works for beneficiary, nonprofit_staff, vendor, cpa, auditor, attorney, grant_officer
//
// Body params:
//   userId: string (required)
//   mode: "send_email" | "generate_link" (default: "send_email")
//   overrideEmail: string (optional — send invite to a different email address)

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { validateRecipientEmail, sanitizeEmailForLog, buildSecureLink } from "@/lib/email-security";
import { sendEmail } from "@/lib/services/email-service";
import { buildInviteEmail } from "@/lib/services/email-templates";
import { NextResponse } from "next/server";

const INVITE_EXPIRY_DAYS = 7;

const INVITABLE_ROLES = [
  "beneficiary",
  "nonprofit_staff",
  "vendor",
  "cpa",
  "auditor",
  "attorney",
  "grant_officer",
];

export async function POST(request: Request) {
  try {
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

    // Validate overrideEmail if provided
    if (overrideEmail) {
      const emailCheck = validateRecipientEmail(overrideEmail);
      if (!emailCheck.valid) {
        return NextResponse.json({ error: emailCheck.reason || "Invalid email address" }, { status: 400 });
      }
    }

    // Verify the user exists, belongs to the org, and has an invitable role
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        role: true,
        passwordHash: true,
        organization: { select: { name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!INVITABLE_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: `Cannot invite users with role: ${user.role}` },
        { status: 400 },
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
    console.error("POST /api/invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}


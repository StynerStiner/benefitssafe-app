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

      if (process.env.POSTMARK_API_TOKEN) {
        try {
          const emailRes = await fetch("https://api.postmarkapp.com/email", {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json",
              "X-Postmark-Server-Token": process.env.POSTMARK_API_TOKEN,
            },
            body: JSON.stringify({
              From: process.env.POSTMARK_FROM_EMAIL || "noreply@benefitssafe.com",
              To: user.email,
              Subject: "You've been invited to BenefitsSafe",
              HtmlBody: buildInviteEmailHtml(user.firstName, user.organization.name, user.email, inviteUrl),
              TextBody: `Hi ${user.firstName},\n\n${user.organization.name} has invited you to BenefitsSafe.\n\nYour login email is: ${user.email}\n\nSet up your account: ${inviteUrl}\n\nThis link expires in ${INVITE_EXPIRY_DAYS} days.`,
              MessageStream: "outbound",
              Headers: [
                { Name: "X-BenefitsSafe-Invite", Value: "true" },
              ],
            }),
          });

          emailSent = emailRes.ok;
          if (!emailRes.ok) {
            console.error("Postmark email failed:", await emailRes.text());
          }
        } catch (emailError) {
          console.error("Failed to send invite email:", emailError);
        }
      } else {
        // Log to console when Postmark not configured (dev mode)
        console.log("\n========================================");
        console.log("INVITE EMAIL (Postmark not configured)");
        console.log("========================================");
        console.log(`To: ${user.email}`);
        console.log(`Name: ${user.firstName}`);
        console.log(`Org: ${user.organization.name}`);
        console.log(`Role: ${user.role}`);
        console.log(`Link: ${inviteUrl}`);
        console.log(`Expires: ${invite.expiresAt.toISOString()}`);
        console.log("========================================\n");
        emailSent = true; // In dev, console log counts as "sent"
      }
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

function buildInviteEmailHtml(firstName: string, orgName: string, email: string, inviteUrl: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="background: #1B2A4A; color: white; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">&#9632;</div>
          <span style="font-size: 20px; font-weight: 700; color: #111827;">BenefitsSafe</span>
        </div>
      </div>
      <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 16px;">You're invited!</h1>
      <p style="font-size: 16px; color: #4B5563; line-height: 1.6;">Hi ${firstName},</p>
      <p style="font-size: 16px; color: #4B5563; line-height: 1.6;">
        <strong>${orgName}</strong> has invited you to BenefitsSafe, a secure platform for managing grant disbursements.
      </p>
      <p style="font-size: 16px; color: #4B5563; line-height: 1.6;">
        Your login email is: <strong>${email}</strong>
      </p>
      <p style="font-size: 16px; color: #4B5563; line-height: 1.6;">
        Click the button below to set up your password and access your account. This link expires in ${INVITE_EXPIRY_DAYS} days.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${inviteUrl}" style="background: #1B2A4A; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
          Set Up My Account
        </a>
      </div>
      <p style="font-size: 13px; color: #9CA3AF; line-height: 1.5;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;" />
      <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
        BenefitsSafe -- Secure grant disbursement for nonprofits
      </p>
    </div>
  `;
}

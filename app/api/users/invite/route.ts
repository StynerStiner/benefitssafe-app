// POST /api/users/invite — Invite a new team member by email + role
//
// Multi-org aware: a single User can hold the same or different team role
// at many nonprofits via OrganizationMembership. When the email is already
// known, we link the existing user into THIS org via a new membership
// instead of returning 409.

import { auth } from "@/auth";
import { isPlatformInvitableRole } from "@/lib/constants/invitable-roles";
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

    // Plan limit gate: count active team memberships in this org. We count
    // memberships (not User rows) because at multi-org scale a team member's
    // User.organizationId may point at a *different* nonprofit while their
    // active team membership lives here. Counting User rows would silently
    // undercount and let an org exceed its team-member cap.
    const currentTeamCount = await prisma.organizationMembership.count({
      where: {
        organizationId,
        status: "active",
        role: { notIn: ["beneficiary", "vendor", "family_member"] },
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

    // ------------------------------------------------------------------
    // Multi-org link branch: if a User with this email exists, attach
    // them to THIS org via a new OrganizationMembership instead of
    // returning 409. The same person can be a CPA at 5 nonprofits, a
    // staff member at one and an auditor at another, etc. Their per-org
    // role lives on the membership row, not on User.role.
    //
    // Cross-org isolation rules in this branch (identical to the
    // beneficiary POST link branch):
    //   - We NEVER reveal which other orgs the user already belongs to.
    //   - We NEVER touch User.organizationId (that's the user's currently
    //     active session org, mutated only by /api/memberships/switch).
    //   - We NEVER overwrite User-level fields (firstName, lastName, phone).
    //   - The membership role is the *invited* role, not the existing
    //     User.role — auth.ts resolves the per-org role via membership.
    // ------------------------------------------------------------------
    const existing = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });

    if (existing) {
      // Reject if the existing user is BenefitsSafe internal staff. Those
      // accounts must never be re-purposed as a nonprofit team member —
      // generic 409 to avoid role enumeration.
      if (isPlatformInvitableRole(existing.role)) {
        return NextResponse.json(
          { error: "This email is already a member of your organization" },
          { status: 409 },
        );
      }

      // Already a member of THIS org? Hard 409.
      const existingMembership = await prisma.organizationMembership.findFirst({
        where: { userId: existing.id, organizationId },
        select: { id: true },
      });
      if (existingMembership) {
        return NextResponse.json(
          { error: "This email is already a member of your organization" },
          { status: 409 },
        );
      }

      // Create the new membership at the invited role + per-org TM- code.
      const memberCode = await generateMembershipCode(prisma, organizationId, inviteRole);
      const linkedMembership = await prisma.organizationMembership.create({
        data: {
          userId: existing.id,
          organizationId,
          role: inviteRole,
          memberCode,
          status: "pending",
          invitedBy: session.user.id,
          isDefaultOrg: false,
        },
        select: { id: true, memberCode: true },
      });

      // Notify the linked user in-app — they'll see this when they next
      // log in (or immediately if they're already signed in elsewhere).
      // The notification is scoped to the inviting org so it never leaks
      // into another tenant's notification feed.
      await prisma.notification.create({
        data: {
          userId: existing.id,
          organizationId,
          type: "org_invitation",
          title: "Added to a new organization",
          message: `You have been added as ${inviteRole.replace(/_/g, " ")} to ${session.user.organizationName}.`,
          href: "/settings/organizations",
        },
      });

      // If the user has no password yet (they were invited somewhere but
      // never accepted), send a fresh InviteToken so they can set one
      // and complete onboarding. If they already have a password, skip
      // the email — they can already log in.
      let invitedEmailSent = false;
      let resentInviteUrl: string | null = null;
      if (!existing.passwordHash) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        const invite = await prisma.inviteToken.create({
          data: {
            userId: existing.id,
            sentTo: email,
            method: "email",
            sentById: session.user.id,
            expiresAt,
          },
          select: { token: true },
        });
        resentInviteUrl = buildSecureLink(`/auth/accept-invite?token=${invite.token}`);

        const inviteEmailContent = buildInviteEmail({
          firstName: existing.firstName,
          orgName: session.user.organizationName,
          inviteUrl: resentInviteUrl,
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
        invitedEmailSent = sendResult.sent || sendResult.skipped;
      }

      // Audit log scoped to the inviting org only.
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId,
          action: "link_existing_team_member",
          entityType: "user",
          entityId: existing.id,
          newValue: {
            email: sanitizeEmailForLog(email),
            role: inviteRole,
            memberCode: linkedMembership.memberCode,
            sentInvite: !existing.passwordHash,
            emailSent: invitedEmailSent,
          },
        },
      });

      return NextResponse.json(
        {
          message: "Team member linked to your organization",
          user: {
            id: existing.id,
            email: existing.email,
            firstName: existing.firstName,
            lastName: existing.lastName,
            role: inviteRole,
          },
          memberCode: linkedMembership.memberCode,
          existingUser: true,
          inviteUrl: resentInviteUrl,
        },
        { status: 201 },
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

// POST /api/memberships/invite -- Invite a user to the current organization
// Only nonprofit_admin and platform_admin can invite.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { validateRecipientEmail } from "@/lib/email-security";
import { generateMembershipCode } from "@/lib/utils/membership-code";
import { NextResponse } from "next/server";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Valid email is required"),
  role: z.string().min(1, "Role is required"),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, id: userId } = session.user;

    // Verify inviter is an admin in this org via membership
    const inviterMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        status: "active",
        role: { in: ["nonprofit_admin", "platform_admin"] },
      },
    });

    if (!inviterMembership) {
      return NextResponse.json(
        { error: "Only admins can invite users" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { email, role } = parsed.data;

    // Validate email
    const emailCheck = validateRecipientEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.reason || "Invalid email address" },
        { status: 400 },
      );
    }

    // Find existing user
    const targetUser = await prisma.user.findUnique({
      where: { email },
    });

    if (targetUser) {
      // Check if already a member
      const existingMembership = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: targetUser.id,
            organizationId,
          },
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: "User is already a member of this organization" },
          { status: 409 },
        );
      }

      // Generate memberCode via shared utility (prefix derived from role)
      const memberCode = await generateMembershipCode(prisma, organizationId, role);

      // Create pending membership
      const membership = await prisma.organizationMembership.create({
        data: {
          userId: targetUser.id,
          organizationId,
          role,
          memberCode,
          status: "pending",
          invitedBy: userId,
        },
      });

      // Notify the invited user
      await prisma.notification.create({
        data: {
          userId: targetUser.id,
          organizationId,
          type: "org_invitation",
          title: "Organization Invitation",
          message: `You have been invited to join an organization as ${role.replace(/_/g, " ")}.`,
          href: "/settings/organizations",
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId,
          organizationId,
          action: "invite_to_org",
          entityType: "membership",
          entityId: membership.id,
          newValue: { email, role, status: "pending" },
        },
      });

      return NextResponse.json({
        success: true,
        membership,
        userExists: true,
      }, { status: 201 });
    }

    // User does not exist yet
    return NextResponse.json(
      {
        error: "User not found. They need to create an account first, then you can invite them.",
      },
      { status: 404 },
    );
  } catch (error) {
    console.error("POST /api/memberships/invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

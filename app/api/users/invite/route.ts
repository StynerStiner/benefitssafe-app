// POST /api/users/invite — Invite a new team member by email + role
// Creates User record, sends invite via existing invite system

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
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

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
    const inviteUrl = `${baseUrl}/auth/accept-invite?token=${invite.token}`;

    // Log invite URL (in production, send via Postmark)
    if (!process.env.POSTMARK_API_TOKEN) {
      console.log("\n========================================");
      console.log("TEAM INVITE (Postmark not configured)");
      console.log("========================================");
      console.log(`To: ${email}`);
      console.log(`Name: ${firstName} ${lastName}`);
      console.log(`Role: ${inviteRole}`);
      console.log(`Link: ${inviteUrl}`);
      console.log(`Expires: ${invite.expiresAt.toISOString()}`);
      console.log("========================================\n");
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "invite",
        entityType: "user",
        entityId: newUser.id,
        newValue: JSON.parse(JSON.stringify({
          email,
          role: inviteRole,
          firstName,
          lastName,
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

// GET  /api/auth/accept-invite?token=xxx — Verify invite token
// POST /api/auth/accept-invite         — Accept invite and set password

import { prisma } from "@/lib/db";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

// GET: Verify token and return user info
export async function GET(request: Request) {
  try {
    // Rate limit: 10 token verifications per minute per IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const rateLimitResult = rateLimit(`auth:${ip}`, RATE_LIMIT_CONFIGS.auth);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "server", message: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const invite = await prisma.inviteToken.findUnique({
      where: { token },
      select: {
        id: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            passwordHash: true,
            organization: { select: { name: true } },
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "invalid", message: "This invite link is not valid." },
        { status: 404 },
      );
    }

    if (invite.usedAt) {
      return NextResponse.json(
        { error: "used", message: "This invite has already been used. Sign in with your email and password." },
        { status: 410 },
      );
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: "expired", message: "This invite has expired. Ask your organization to send a new one." },
        { status: 410 },
      );
    }

    if (invite.user.passwordHash) {
      return NextResponse.json(
        { error: "used", message: "This account already has a password set up. Sign in with your email and password." },
        { status: 410 },
      );
    }

    return NextResponse.json({
      email: invite.user.email,
      firstName: invite.user.firstName,
      lastName: invite.user.lastName,
      role: invite.user.role,
      organizationName: invite.user.organization.name,
    });
  } catch (error) {
    console.error("GET /api/auth/accept-invite error:", error);
    return NextResponse.json(
      { error: "server", message: "Internal server error" },
      { status: 500 },
    );
  }
}

const acceptSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-zA-Z]/, "Must contain at least one letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Must contain at least one special character"),
});

// POST: Accept invite and set password
export async function POST(request: Request) {
  try {
    // Rate limit: 5 password set attempts per minute per IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const rateLimitResult2 = rateLimit(`auth:${ip}`, RATE_LIMIT_CONFIGS.auth);
    if (!rateLimitResult2.allowed) {
      return NextResponse.json(
        { error: "server", message: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = acceptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { token, password } = parsed.data;

    const invite = await prisma.inviteToken.findUnique({
      where: { token },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            passwordHash: true,
            organizationId: true,
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "invalid", message: "This invite link is not valid." },
        { status: 404 },
      );
    }

    if (invite.usedAt) {
      return NextResponse.json(
        { error: "used", message: "This invite has already been used." },
        { status: 410 },
      );
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: "expired", message: "This invite has expired." },
        { status: 410 },
      );
    }

    if (invite.user.passwordHash) {
      return NextResponse.json(
        { error: "used", message: "This account already has a password." },
        { status: 410 },
      );
    }

    // Hash password and update user + mark token as used
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: invite.userId },
        data: { passwordHash, isActive: true },
      }),
      prisma.inviteToken.updateMany({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      // Update OrganizationMembership from "pending" to "active"
      prisma.organizationMembership.updateMany({
        where: {
          userId: invite.userId,
          organizationId: invite.user.organizationId,
          status: "pending",
        },
        data: { status: "active" },
      }),
      prisma.auditLog.create({
        data: {
          userId: invite.userId,
          organizationId: invite.user.organizationId,
          action: "accept_invite",
          entityType: "user",
          entityId: invite.userId,
          newValue: JSON.parse(JSON.stringify({
            email: invite.user.email,
            acceptedAt: new Date().toISOString(),
            membershipStatus: "active",
          })),
        },
      }),
    ]);

    return NextResponse.json({
      message: "Account set up successfully",
      email: invite.user.email,
      redirect: "/auth/login?onboarded=true",
    });
  } catch (error) {
    console.error("POST /api/auth/accept-invite error:", error);
    return NextResponse.json(
      { error: "server", message: "Internal server error" },
      { status: 500 },
    );
  }
}

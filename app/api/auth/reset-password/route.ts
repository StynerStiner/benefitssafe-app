// POST /api/auth/reset-password
//
// Body: { token: string, password: string }
//
// Validates a password-reset InviteToken, hashes the new password with
// bcrypt, updates User.passwordHash, marks the token as used, and
// invalidates every other unused password-reset token for the user.
// Audit logs the event.

import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

const resetPasswordSchema = z.object({
  token: z.string().min(10).max(256),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(256),
});

const BCRYPT_ROUNDS = 12;

export async function POST(request: Request) {
  try {
    // Rate limit per IP BEFORE bcrypt. bcrypt(rounds=12) costs ~250ms of
    // CPU per call; without a gate, a bot can pin every server core and
    // DoS the auth system. 5 attempts per 15 minutes per IP is enough for
    // a real user fat-fingering their password.
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const limit = rateLimit(`reset-password:${ip}`, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000),
            ),
          },
        },
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid token or password", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { token, password } = parsed.data;

    const inviteToken = await prisma.inviteToken.findUnique({
      where: { token },
      select: {
        id: true,
        userId: true,
        method: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    // Must exist, be a password_reset token, not used, not expired.
    if (!inviteToken || inviteToken.method !== "password_reset") {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 },
      );
    }
    if (inviteToken.usedAt) {
      return NextResponse.json(
        { error: "This reset link has already been used. Request a new one." },
        { status: 400 },
      );
    }
    if (inviteToken.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This reset link has expired. Request a new one." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: inviteToken.userId },
      select: { id: true, email: true, organizationId: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Atomic: update password, mark this token used, invalidate any other
    // unused password-reset tokens for the user (defense against replay).
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.inviteToken.update({
        where: { id: inviteToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.inviteToken.updateMany({
        where: {
          userId: user.id,
          method: "password_reset",
          usedAt: null,
          id: { not: inviteToken.id },
        },
        data: { usedAt: new Date() },
      }),
    ]);

    await prisma.auditLog
      .create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          action: "password_reset_completed",
          entityType: "auth",
          entityId: user.id,
          newValue: { email: user.email },
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/reset-password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

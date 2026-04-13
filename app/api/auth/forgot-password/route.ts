// POST /api/auth/forgot-password
//
// Body: { email: string }
//
// Generates a password-reset InviteToken (method="password_reset", 60 min
// expiry) and emails the user a reset link via the centralized email
// service. Always returns 200 with a generic message, even when the email
// is not found, so an attacker cannot probe for account existence.
//
// Rate limit: max 3 reset tokens per email per hour — enforced by counting
// rows in InviteToken. If exceeded, still return 200 (no leak).

import { prisma } from "@/lib/db";
import { validateRecipientEmail } from "@/lib/email-security";
import { sendEmail } from "@/lib/services/email-service";
import { buildPasswordResetEmail } from "@/lib/services/email-templates";
import { NextResponse } from "next/server";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});

const GENERIC_OK = {
  success: true,
  message: "If an account with that email exists, we've sent a password reset link.",
};

const TOKEN_TTL_MINUTES = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      // Bad input — don't reveal which field failed, just say OK.
      return NextResponse.json(GENERIC_OK);
    }

    const email = parsed.data.email.trim().toLowerCase();

    // Defense in depth: refuse disposable/injection emails outright.
    const validity = validateRecipientEmail(email);
    if (!validity.valid) {
      return NextResponse.json(GENERIC_OK);
    }

    // Rate limit per email per hour. We count prior password_reset rows in
    // InviteToken — no Redis required, no schema change.
    const recentCount = await prisma.inviteToken.count({
      where: {
        sentTo: email,
        method: "password_reset",
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
    });
    if (recentCount >= RATE_LIMIT_MAX) {
      return NextResponse.json(GENERIC_OK);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });

    // Always return OK — do not leak whether the email is registered.
    if (!user) {
      return NextResponse.json(GENERIC_OK);
    }

    // Generate the reset token. Reusing InviteToken with method="password_reset"
    // keeps us on the existing schema. The reset-password route verifies
    // method, expiry, and usedAt before honoring the token.
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
    const token = await prisma.inviteToken.create({
      data: {
        userId: user.id,
        sentTo: email,
        method: "password_reset",
        sentById: user.id,
        expiresAt,
      },
      select: { token: true },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";
    const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token.token)}`;

    const tmpl = buildPasswordResetEmail({
      firstName: user.firstName || "there",
      orgName: user.organization?.name,
      resetUrl,
      expiresMinutes: TOKEN_TTL_MINUTES,
    });

    // Fire the email. sendEmail is already graceful (console fallback in dev,
    // error logging in prod). Don't block the response on audit log writes.
    await sendEmail({
      to: user.email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
      orgName: user.organization?.name,
      userId: user.id,
      organizationId: user.organizationId,
      emailType: "password_reset",
    });

    // Best-effort audit entry at the route level too, so we can trace
    // password reset *requests* even if the email write failed.
    prisma.auditLog
      .create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          action: "password_reset_requested",
          entityType: "auth",
          entityId: user.id,
          newValue: { email },
        },
      })
      .catch(() => {});

    return NextResponse.json(GENERIC_OK);
  } catch (error) {
    console.error("POST /api/auth/forgot-password error:", error);
    // Even on errors, return the generic OK so attackers can't distinguish
    // between "user exists and send failed" and "user doesn't exist".
    return NextResponse.json(GENERIC_OK);
  }
}

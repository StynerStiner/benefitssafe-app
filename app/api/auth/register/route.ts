// @ts-nocheck
import { prisma } from "@/lib/db";
import { validateRecipientEmail, buildSecureLink } from "@/lib/email-security";
import { stripe } from "@/lib/stripe";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

const DEFAULT_TRIAL_DAYS = 14;

const registerApiSchema = z.object({
  ein: z.string().regex(/^\d{2}-?\d{7}$/, "EIN must be 9 digits").optional(),
  einVerified: z.boolean().optional(),
  organizationName: z.string().min(2, "Organization name is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(15, "Password must be at most 15 characters")
    .regex(/[a-zA-Z]/, "Must contain at least one letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Must contain at least one special character"),
  promoCode: z.string().max(50).optional().or(z.literal("")),
});

/**
 * Extract the email domain from an email address.
 * Returns null for common free email providers (not org-specific).
 */
function getOrgEmailDomain(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  // Free email providers are not org-specific domains
  const freeProviders = [
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "aol.com",
    "icloud.com",
    "mail.com",
    "protonmail.com",
    "proton.me",
    "zoho.com",
    "yandex.com",
    "live.com",
    "msn.com",
    "me.com",
    "mac.com",
    "fastmail.com",
  ];

  if (freeProviders.includes(domain)) {
    return null;
  }

  return domain;
}

export async function POST(request: Request) {
  try {
    // Rate limit: 5 registration attempts per minute per IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const rateLimitResult = rateLimit(`auth:${ip}`, RATE_LIMIT_CONFIGS.auth);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = registerApiSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { ein, einVerified, organizationName, firstName, lastName, email, password, promoCode } = parsed.data;

    // Validate email against disposable domains and injection attacks
    const emailCheck = validateRecipientEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.reason || "Invalid email address" },
        { status: 400 },
      );
    }

    // Normalize EIN: strip dashes for storage
    const normalizedEIN = ein ? ein.replace(/-/g, "") : undefined;

    // ----------------------------------------------------------------
    // ANTI-ABUSE CHECK 1: Duplicate email
    // Generic message prevents email enumeration (A02/A04)
    // ----------------------------------------------------------------
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Unable to create account. If you already have an account, try signing in." },
        { status: 409 },
      );
    }

    // ----------------------------------------------------------------
    // ANTI-ABUSE CHECK 2: One free trial per EIN
    // If the EIN already has an organization with an active/trial status,
    // reject to prevent duplicate trial signups.
    // ----------------------------------------------------------------
    if (normalizedEIN) {
      const existingOrgByEIN = await prisma.organization.findFirst({
        where: {
          ein: normalizedEIN,
          subscriptionStatus: { in: ["trial", "active"] },
        },
        select: { id: true, name: true },
      });

      if (existingOrgByEIN) {
        return NextResponse.json(
          {
            error:
              "An organization with this EIN already has an active account. " +
              "Contact support if you believe this is an error.",
          },
          { status: 409 },
        );
      }
    }

    // ----------------------------------------------------------------
    // ANTI-ABUSE CHECK 3: One free trial per email domain
    // Prevents multiple signups from the same organization using
    // different employees' email addresses. Only applies to
    // non-free-provider domains (e.g., @mynonprofit.org).
    // ----------------------------------------------------------------
    const emailDomain = getOrgEmailDomain(email);
    if (emailDomain) {
      const existingOrgByDomain = await prisma.user.findFirst({
        where: {
          email: { endsWith: `@${emailDomain}` },
          role: "nonprofit_admin",
          organization: {
            subscriptionStatus: { in: ["trial", "active"] },
          },
        },
        select: {
          id: true,
          organization: { select: { id: true, name: true } },
        },
      });

      if (existingOrgByDomain) {
        return NextResponse.json(
          {
            error:
              "An organization with this email domain already has an active account. " +
              "Ask your admin for an invite instead.",
          },
          { status: 409 },
        );
      }
    }

    // ----------------------------------------------------------------
    // PROMO CODE VALIDATION (if provided)
    // ----------------------------------------------------------------
    let validPromoCode: {
      id: string;
      code: string;
      trialDays: number;
      description: string | null;
    } | null = null;

    const trimmedPromo = promoCode?.trim().toUpperCase();
    if (trimmedPromo) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: trimmedPromo },
        select: {
          id: true,
          code: true,
          description: true,
          trialDays: true,
          maxUses: true,
          currentUses: true,
          isActive: true,
          expiresAt: true,
        },
      });

      if (!promo) {
        return NextResponse.json(
          { error: "Invalid promo code" },
          { status: 400 },
        );
      }

      if (!promo.isActive) {
        return NextResponse.json(
          { error: "This promo code is no longer active" },
          { status: 400 },
        );
      }

      if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
        return NextResponse.json(
          { error: "This promo code has expired" },
          { status: 400 },
        );
      }

      if (promo.currentUses >= promo.maxUses) {
        return NextResponse.json(
          { error: "This promo code has reached its usage limit" },
          { status: 400 },
        );
      }

      validPromoCode = {
        id: promo.id,
        code: promo.code,
        trialDays: promo.trialDays,
        description: promo.description,
      };
    }

    // ----------------------------------------------------------------
    // CALCULATE TRIAL DATES
    // ----------------------------------------------------------------
    const now = new Date();
    const trialDays = validPromoCode
      ? validPromoCode.trialDays
      : DEFAULT_TRIAL_DAYS;
    const trialEndDate = new Date(now);
    trialEndDate.setDate(trialEndDate.getDate() + trialDays);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create Stripe Connect account for the organization
    let stripeAccountId: string | null = null;
    let stripeCardholderIdId: string | null = null;

    try {
      // Create Stripe Connect Express account
      const stripeAccount = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: email.toLowerCase().trim(),
        business_profile: {
          name: organizationName.trim(),
          product_category: "non_profit",
        },
      });
      stripeAccountId = stripeAccount.id;

      // Create cardholder for issuing cards
      const cardholder = await stripe.issuing.cardholders.create({
        type: "business",
        billing: {
          address: {
            country: "US",
          },
        },
        name: organizationName.trim(),
        email: email.toLowerCase().trim(),
      });
      stripeCardholderIdId = cardholder.id;
    } catch (stripeError) {
      console.error("Stripe account creation failed:", stripeError);
      // Don't fail registration if Stripe fails -- log but continue
      // Organization can be connected to Stripe later
    }

    // Generate email verification token
    const emailVerifyToken = crypto.randomUUID();
    const emailVerifyExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Create Organization + Admin User + Promo Redemption in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName.trim(),
          ein: normalizedEIN,
          einVerified: einVerified === true,
          stripeAccountId,
          stripeCardholderIdId,
          trialStartDate: now,
          trialEndDate,
          subscriptionStatus: "trial",
        },
        select: {
          id: true,
          name: true,
          stripeAccountId: true,
          ein: true,
          einVerified: true,
          trialStartDate: true,
          trialEndDate: true,
          subscriptionStatus: true,
        },
      });

      const user = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          passwordHash,
          role: "nonprofit_admin",
          organizationId: organization.id,
          emailVerified: false,
          emailVerifyToken,
          emailVerifyExpiry,
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      // If promo code was provided, create redemption and increment usage
      if (validPromoCode) {
        await tx.promoRedemption.create({
          data: {
            promoCodeId: validPromoCode.id,
            organizationId: organization.id,
            redeemedById: user.id,
          },
        });

        await tx.promoCode.update({
          where: { id: validPromoCode.id },
          data: { currentUses: { increment: 1 } },
        });

        // Audit log for promo redemption
        await tx.auditLog.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            action: "redeem",
            entityType: "promo_code",
            entityId: validPromoCode.id,
            newValue: JSON.parse(JSON.stringify({
              promoCode: validPromoCode.code,
              trialDays: validPromoCode.trialDays,
              trialEndDate: trialEndDate.toISOString(),
            })),
          },
        });
      }

      // Audit log for organization creation
      await tx.auditLog.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          action: "create",
          entityType: "organization",
          entityId: organization.id,
          newValue: JSON.parse(JSON.stringify({
            organizationName: organization.name,
            ein: organization.ein || null,
            einVerified: organization.einVerified,
            adminEmail: user.email,
            adminName: `${user.firstName} ${user.lastName}`,
            stripeConnected: !!stripeAccountId,
            trialDays,
            trialEndDate: trialEndDate.toISOString(),
            promoCodeUsed: validPromoCode?.code || null,
            subscriptionStatus: "trial",
          })),
        },
      });

      return { organization, user };
    });

    // TODO: Send verification email via Postmark/SendGrid
    // For now, log the verification URL to console for development
    const verificationUrl = buildSecureLink(`/api/auth/verify-email?token=${emailVerifyToken}`);
    console.log("-----------------------------------------------------------");
    console.log("EMAIL VERIFICATION LINK (dev only):");
    console.log(verificationUrl);
    console.log("-----------------------------------------------------------");

    return NextResponse.json(
      {
        message: "Organization created successfully",
        organizationId: result.organization.id,
        userId: result.user.id,
        einVerified: result.organization.einVerified,
        stripeConnected: !!stripeAccountId,
        onboardingRequired: !stripeAccountId,
        trialDays,
        trialEndDate: trialEndDate.toISOString(),
        promoCodeApplied: validPromoCode?.code || null,
        emailVerificationRequired: true,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error("POST /api/auth/register error:", err.message);

    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

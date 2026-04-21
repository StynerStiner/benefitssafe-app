// @ts-nocheck
import { prisma } from "@/lib/db";
import { validateRecipientEmail, buildSecureLink } from "@/lib/email-security";
import { stripe } from "@/lib/stripe";
import {
  stripeCircuit,
  CircuitOpenError,
  CircuitTimeoutError,
  CIRCUIT_OPEN_COOLDOWN_MS,
} from "@/lib/stripe-circuit";
import { errorResponse } from "@/lib/error-response";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { stripeIdempotencyKey } from "@/lib/stripe-idempotency";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

const ROUTE = "api/auth/register:POST";

const DEFAULT_TRIAL_DAYS = 14;

const registerApiSchema = z.object({
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
  stripeSessionId: z.string().max(200).optional(),
  plan: z.string().max(50).optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms and Privacy Policy" }),
  }),
  termsVersion: z.string().max(20),
  privacyVersion: z.string().max(20),
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

    const {
      organizationName,
      firstName,
      lastName,
      email,
      password,
      promoCode,
      stripeSessionId,
      plan,
      termsVersion,
      privacyVersion,
    } = parsed.data;

    // Validate email against disposable domains and injection attacks
    const emailCheck = validateRecipientEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.reason || "Invalid email address" },
        { status: 400 },
      );
    }

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
    // ANTI-ABUSE CHECK 2: One free trial per email domain
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

    // Create Stripe Connect account for the organization.
    //
    // Note: we do NOT pre-create an Issuing cardholder here. Cardholders
    // live on the nonprofit's own connected account and must be created
    // per-beneficiary just-in-time during card issuance (with full KYC).
    // A platform-scoped org cardholder has no callers anywhere in the app
    // and the previous code wrote it to a non-existent Organization
    // column (`stripeCardholderIdId`), meaning the path was dead-lettered
    // at Prisma validation time anyway.
    let stripeAccountId: string | null = null;

    try {
      // DDIA Ch8 — idempotency key on signup-time account create. A
      // network retry without a key creates a second Stripe Connect
      // account. Key on email (normalized) because the org row
      // doesn't exist yet at this point.
      const stripeAccount = await stripeCircuit.run(
        `${ROUTE}:stripe.accounts.create`,
        { mode: "write" },
        () => stripe.accounts.create(
          {
            type: "express",
            country: "US",
            email: email.toLowerCase().trim(),
            business_profile: {
              name: organizationName.trim(),
              product_category: "non_profit",
            },
          },
          { idempotencyKey: stripeIdempotencyKey("signup-acct", email.toLowerCase().trim()) },
        ),
      );
      stripeAccountId = stripeAccount.id;
    } catch (stripeError) {
      // Pattern β: bubble circuit errors to outer catch for 503 mapping.
      if (stripeError instanceof CircuitOpenError || stripeError instanceof CircuitTimeoutError) throw stripeError;
      console.error("Stripe account creation failed:", stripeError);
      // Don't fail registration if Stripe fails — the org can finish
      // onboarding later via /api/org/stripe-onboarding.
    }

    // Generate email verification token
    const emailVerifyToken = crypto.randomUUID();
    const emailVerifyExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Create Organization + Admin User + Promo Redemption in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate orgCode: ORG-{seq} where seq = total existing orgs + 1
      const existingOrgCount = await tx.organization.count();
      const orgCode = `ORG-${String(existingOrgCount + 1).padStart(5, "0")}`;

      const organization = await tx.organization.create({
        data: {
          name: organizationName.trim(),
          orgCode,
          stripeAccountId,
          trialStartDate: now,
          trialEndDate,
          subscriptionStatus: "trial",
        },
        select: {
          id: true,
          name: true,
          orgCode: true,
          stripeAccountId: true,
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
          termsAcceptedAt: now,
          termsVersion,
          privacyAcceptedAt: now,
          privacyVersion,
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

    // ----------------------------------------------------------------
    // LINK STRIPE CHECKOUT SESSION (if paid signup via checkout-direct)
    // ----------------------------------------------------------------
    if (stripeSessionId) {
      try {
        const checkoutSession = await stripeCircuit.run(
          `${ROUTE}:stripe.checkout.sessions.retrieve`,
          { mode: "read" },
          () => stripe.checkout.sessions.retrieve(stripeSessionId, {
            expand: ["subscription"],
          }),
        );

        if (checkoutSession.payment_status === "paid" || checkoutSession.status === "complete") {
          const stripeCustomerId = typeof checkoutSession.customer === "string"
            ? checkoutSession.customer
            : checkoutSession.customer?.id;
          const stripeSubscription = checkoutSession.subscription;
          const stripeSubscriptionId = typeof stripeSubscription === "string"
            ? stripeSubscription
            : stripeSubscription?.id;
          const stripePriceId = typeof stripeSubscription !== "string" && stripeSubscription?.items?.data?.[0]?.price?.id;

          // Link subscription to organization
          if (stripeCustomerId && stripeSubscriptionId) {
            const billingTier = plan || "free";

            await prisma.billingSubscription.upsert({
              where: { organizationId: result.organization.id },
              create: {
                organizationId: result.organization.id,
                stripeCustomerId,
                stripeSubscriptionId,
                stripePriceId: stripePriceId || null,
                tier: billingTier,
                status: "active",
                currentPeriodStart: typeof stripeSubscription !== "string" ? new Date(stripeSubscription.current_period_start * 1000) : new Date(),
                currentPeriodEnd: typeof stripeSubscription !== "string" ? new Date(stripeSubscription.current_period_end * 1000) : new Date(),
              },
              update: {
                stripeCustomerId,
                stripeSubscriptionId,
                stripePriceId: stripePriceId || null,
                tier: billingTier,
                status: "active",
              },
            });

            await prisma.organization.update({
              where: { id: result.organization.id },
              data: { subscriptionStatus: "active" },
            });

            // Audit log for subscription linking
            await prisma.auditLog.create({
              data: {
                userId: result.user.id,
                organizationId: result.organization.id,
                action: "link_subscription",
                entityType: "billing",
                entityId: stripeSubscriptionId,
                newValue: JSON.parse(JSON.stringify({
                  stripeCustomerId,
                  stripeSubscriptionId,
                  tier: billingTier,
                  source: "checkout_direct_registration",
                })),
              },
            });
          }
        }
      } catch (stripeSessionError) {
        // Pattern β: bubble circuit errors to outer catch for 503 mapping.
        if (stripeSessionError instanceof CircuitOpenError || stripeSessionError instanceof CircuitTimeoutError) throw stripeSessionError;
        console.error("Failed to link checkout session:", stripeSessionError);
        // Don't fail registration — subscription can be linked later via webhook
      }
    }

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
    if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) {
      const retryAfterSeconds =
        error instanceof CircuitOpenError
          ? Math.ceil(error.cooldown_ms_remaining / 1000)
          : Math.ceil(CIRCUIT_OPEN_COOLDOWN_MS / 1000);
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Stripe is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds,
        cause: error,
      });
    }
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

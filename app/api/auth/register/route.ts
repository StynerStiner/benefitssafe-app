// @ts-nocheck
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

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
});

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

    const { ein, einVerified, organizationName, firstName, lastName, email, password } = parsed.data;

    // Normalize EIN: strip dashes for storage
    const normalizedEIN = ein ? ein.replace(/-/g, "") : undefined;

    // Check for existing email
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

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
      // Don't fail registration if Stripe fails — log but continue
      // Organization can be connected to Stripe later
    }

    // Create Organization + Admin User in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName.trim(),
          ein: normalizedEIN,
          einVerified: einVerified === true,
          stripeAccountId,
          stripeCardholderIdId,
        },
        select: { id: true, name: true, stripeAccountId: true, ein: true, einVerified: true },
      });

      const user = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          passwordHash,
          role: "nonprofit_admin",
          organizationId: organization.id,
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      // Audit log
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
          })),
        },
      });

      return { organization, user };
    });

    return NextResponse.json(
      {
        message: "Organization created successfully",
        organizationId: result.organization.id,
        userId: result.user.id,
        einVerified: result.organization.einVerified,
        stripeConnected: !!stripeAccountId,
        onboardingRequired: !stripeAccountId,
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

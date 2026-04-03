// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { validateRecipientEmail } from "@/lib/email-security";
import { captureApiError } from "@/lib/error-handler";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { createBeneficiarySchema } from "@/lib/validations/beneficiary";
import { NextResponse } from "next/server";

// GET /api/beneficiaries — list beneficiaries scoped to organization (paginated)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    // Parse and validate pagination params
    const rawLimit = parseInt(searchParams.get("limit") ?? "25", 10);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 25 : rawLimit, 1), 100);
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

    const includeInactive = searchParams.get("includeInactive") === "true";
    const userWhere = {
      organizationId,
      role: "beneficiary" as const,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const [beneficiaries, total] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          beneficiaryCode: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          addressCity: true,
          addressState: true,
          isActive: true,
          passwordHash: false,
          createdAt: true,
          benefitPrograms: true,
          grants: {
            where: { archivedAt: null },
            select: {
              id: true,
              name: true,
              status: true,
              remainingAmount: true,
            },
          },
          memberships: {
            where: { organizationId },
            select: { status: true },
            take: 1,
          },
          inviteTokens: {
            where: { expiresAt: { gt: new Date() } },
            select: { usedAt: true },
            orderBy: { createdAt: "desc" as const },
            take: 1,
          },
        },
        orderBy: { lastName: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where: userWhere }),
    ]);

    // Transform to include summary stats and onboarding status
    const result = beneficiaries.map((b) => {
      const activeGrants = b.grants.filter((g) => g.status === "ACTIVE");
      const totalRemaining = b.grants.reduce(
        (sum, g) => sum + Number(g.remainingAmount),
        0,
      );

      // Compute onboarding status
      const membershipStatus = b.memberships[0]?.status || "pending";
      const latestToken = b.inviteTokens[0];
      let onboardingStatus: "active" | "pending_password" | "pending_invite" = "pending_invite";

      if (membershipStatus === "active") {
        onboardingStatus = "active";
      } else if (latestToken && !latestToken.usedAt) {
        // Token exists but hasn't been used -- invite sent, password not set
        onboardingStatus = "pending_password";
      }

      return {
        id: b.id,
        beneficiaryCode: b.beneficiaryCode,
        firstName: b.firstName,
        lastName: b.lastName,
        email: b.email,
        phone: b.phone,
        avatarUrl: b.avatarUrl,
        addressCity: b.addressCity,
        addressState: b.addressState,
        isActive: b.isActive,
        createdAt: b.createdAt,
        benefitPrograms: b.benefitPrograms,
        activeGrantCount: activeGrants.length,
        totalGrantCount: b.grants.length,
        totalRemainingBalance: totalRemaining,
        onboardingStatus,
      };
    });

    return NextResponse.json({ data: result, total, limit, offset });
  } catch (error) {
    captureApiError(error, { route: "GET /api/beneficiaries" });
    console.error("GET /api/beneficiaries error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/beneficiaries — create a new beneficiary
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 20 requests per minute per user
    const rateLimitResult = rateLimit(
      `beneficiary-create:${session.user.id}`,
      RATE_LIMIT_CONFIGS.beneficiaryCreate,
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          },
        },
      );
    }

    const body = await request.json();
    const parsed = createBeneficiarySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Validate email against disposable domains and injection attacks
    const emailCheck = validateRecipientEmail(data.email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.reason || "Invalid email address" },
        { status: 400 },
      );
    }

    // Check for existing email globally (email has unique constraint)
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    // Clean optional empty strings to null
    const clean = (val: string | undefined): string | null =>
      val && val.trim() ? val.trim() : null;

    // Generate collision-safe beneficiary code: BS-{orgSeq}-{benSeq}
    // Count existing beneficiaries in this org to determine sequence number
    const beneficiaryCount = await prisma.user.count({
      where: { organizationId, role: "beneficiary" },
    });

    // Get org sequence from creation order
    const orgCount = await prisma.organization.count({
      where: { createdAt: { lte: new Date() } },
    });

    const beneficiaryCode = `BS-${String(orgCount).padStart(4, "0")}-${String(beneficiaryCount + 1).padStart(5, "0")}`;

    const createData = {
      email: data.email,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: clean(data.phone),
      role: "beneficiary" as const,
      organizationId,
      beneficiaryCode,
      avatarUrl: (data as any).avatarUrl || null,
      dateOfBirth: data.dateOfBirth && data.dateOfBirth.trim() ? new Date(data.dateOfBirth) : null,
      addressStreet: clean(data.addressStreet),
      addressCity: clean(data.addressCity),
      addressState: clean(data.addressState),
      addressZip: clean(data.addressZip),
      ssnLast4: clean(data.ssnLast4),
      benefitPrograms: data.benefitPrograms ? data.benefitPrograms : undefined,
      emergencyContactName: clean(data.emergencyContactName),
      emergencyContactPhone: clean(data.emergencyContactPhone),
      notes: clean(data.notes),
    };

    const beneficiary = await prisma.user.create({
      data: createData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        beneficiaryCode: true,
        createdAt: true,
      },
    });

    // Generate memberCode: TM-{orgSeq}-{memberSeq}
    const orgForCode = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { orgCode: true },
    });

    let orgSeqForMember = "0000";
    if (orgForCode?.orgCode) {
      const match = orgForCode.orgCode.match(/ORG-(\d+)/);
      if (match) {
        orgSeqForMember = match[1];
      }
    }

    const membershipCount = await prisma.organizationMembership.count({
      where: { organizationId },
    });
    const memberCode = `TM-${orgSeqForMember}-${String(membershipCount + 1).padStart(5, "0")}`;

    // Create OrganizationMembership with "pending" status
    await prisma.organizationMembership.create({
      data: {
        userId: beneficiary.id,
        organizationId,
        role: "beneficiary",
        memberCode,
        status: "pending",
        invitedBy: session.user.id,
        isDefaultOrg: true,
      },
    });

    // Auto-generate InviteToken (7-day expiry)
    const INVITE_EXPIRY_DAYS = 7;
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invite = await prisma.inviteToken.create({
      data: {
        userId: beneficiary.id,
        sentTo: beneficiary.email,
        method: "email",
        sentById: session.user.id,
        expiresAt: tokenExpiresAt,
      },
      select: { id: true, token: true, expiresAt: true },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
    const inviteUrl = `${baseUrl}/auth/create-password?token=${invite.token}`;

    // Auto-send invite email (or log to console if Postmark not configured)
    if (process.env.POSTMARK_API_TOKEN) {
      try {
        await fetch("https://api.postmarkapp.com/email", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Postmark-Server-Token": process.env.POSTMARK_API_TOKEN,
          },
          body: JSON.stringify({
            From: process.env.POSTMARK_FROM_EMAIL || "noreply@benefitssafe.com",
            To: beneficiary.email,
            Subject: "You've been invited to BenefitsSafe",
            TextBody: `Hi ${beneficiary.firstName},\n\nYou've been added to BenefitsSafe.\n\nYour Beneficiary Code: ${beneficiary.beneficiaryCode}\n\nSet up your account: ${inviteUrl}\n\nThis link expires in ${INVITE_EXPIRY_DAYS} days.`,
            MessageStream: "outbound",
          }),
        });
      } catch (emailError) {
        console.error("Failed to send invite email:", emailError);
      }
    } else {
      console.log("\n========================================");
      console.log("INVITE EMAIL (Postmark not configured)");
      console.log("========================================");
      console.log(`To: ${beneficiary.email}`);
      console.log(`Name: ${beneficiary.firstName} ${beneficiary.lastName}`);
      console.log(`Code: ${beneficiary.beneficiaryCode}`);
      console.log(`Link: ${inviteUrl}`);
      console.log(`Expires: ${invite.expiresAt.toISOString()}`);
      console.log("========================================\n");
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "create",
        entityType: "user",
        entityId: beneficiary.id,
        newValue: {
          firstName: beneficiary.firstName,
          lastName: beneficiary.lastName,
          email: beneficiary.email,
          role: "beneficiary",
          inviteTokenId: invite.id,
        },
      },
    });

    // Fire workflow automation (non-blocking)
    import("@/lib/workflow-engine").then(({ getWorkflowEngine }) => {
      getWorkflowEngine().fire(organizationId, "beneficiary_onboarded", {
        beneficiaryId: beneficiary.id,
        beneficiaryName: `${beneficiary.firstName} ${beneficiary.lastName}`,
        beneficiaryEmail: beneficiary.email,
        beneficiaryCode: beneficiary.beneficiaryCode || "",
        caseManagerName: session.user?.name || "Admin",
        caseManagerEmail: session.user?.email || "",
      });
    }).catch(() => {});

    return NextResponse.json({
      ...beneficiary,
      inviteUrl: process.env.POSTMARK_API_TOKEN ? undefined : inviteUrl,
    }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string; meta?: unknown; message?: string };
    captureApiError(error, { route: "POST /api/beneficiaries" });
    console.error("POST /api/beneficiaries error:", {
      message: err.message,
      code: err.code,
      meta: err.meta,
    });

    // Handle Prisma unique constraint violation
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

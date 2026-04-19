// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { GuardDenial, requireNonprofitStaff } from "@/lib/auth-guard";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  hashParams,
  jitterTtl,
} from "@/lib/cache";
import { invalidateDashboardCache } from "@/lib/data";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { validateRecipientEmail } from "@/lib/email-security";
import { errorResponse } from "@/lib/error-response";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { createBeneficiarySchema } from "@/lib/validations/beneficiary";
import { checkLimitAccess, buildLimitReachedResponse } from "@/lib/feature-gates";
import { incrementUsage } from "@/lib/usage-tracker";
import { sendEmail } from "@/lib/services/email-service";
import { buildInviteEmail } from "@/lib/services/email-templates";
import { generateMembershipCode } from "@/lib/utils/membership-code";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/beneficiaries:GET";
const ROUTE_POST = "api/beneficiaries:POST";

// GET /api/beneficiaries — list beneficiaries scoped to organization (paginated)
export async function GET(request: Request) {
  try {
    const { organizationId } = await requireNonprofitStaff(ROUTE_GET, "GET");
    const { searchParams } = new URL(request.url);

    // Parse and validate pagination params
    const rawLimit = parseInt(searchParams.get("limit") ?? "25", 10);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 25 : rawLimit, 1), 100);
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

    const includeInactive = searchParams.get("includeInactive") === "true";

    const cacheKey = `${STALE_CACHE_KEY_PREFIX}:${organizationId}:beneficiaries:list:${hashParams(request)}`;
    const staleResult = await cachedWithStaleness({
      key: cacheKey,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.LIST.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.LIST.maxStaleSeconds,
      fetcher: () =>
        buildBeneficiariesListResponse({
          organizationId,
          limit,
          offset,
          includeInactive,
        }),
    });

    if (staleResult.kind === "unavailable") {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_GET,
        method: "GET",
        retryAfterSeconds: 30,
      });
    }

    if (staleResult.kind === "stale") {
      return NextResponse.json(
        {
          ...staleResult.data,
          _meta: {
            stale: true,
            staleSeconds: staleResult.staleSeconds,
            cachedAt: staleResult.cachedAt,
          },
        },
        { headers: { "X-Data-Staleness": String(staleResult.staleSeconds) } },
      );
    }

    return NextResponse.json(staleResult.data);
  } catch (error) {
    if (error instanceof GuardDenial) return error.toErrorResponse();
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_GET,
      method: "GET",
      cause: error,
    });
  }
}

async function buildBeneficiariesListResponse(opts: {
  organizationId: string;
  limit: number;
  offset: number;
  includeInactive: boolean;
}) {
  const { organizationId, limit, offset, includeInactive } = opts;

    // ------------------------------------------------------------------
    // Multi-org list query: scope by OrganizationMembership, NOT by
    // User.organizationId. At 1.8M nonprofits a beneficiary may belong to
    // many orgs simultaneously; their User.organizationId only points to
    // their currently active session org and is the wrong filter for
    // "show me MY org's beneficiaries".
    //
    // Status filter:
    //   default → only active memberships
    //   ?includeInactive=true → all statuses (pending, suspended, etc.)
    //
    // Child data scoping: grants are pulled via the User relation and
    // MUST be filtered by `organizationId` to avoid leaking grants the
    // beneficiary holds at other nonprofits.
    // ------------------------------------------------------------------
    const membershipWhere = {
      organizationId,
      role: "beneficiary",
      ...(includeInactive ? {} : { status: "active" }),
    };

    const [memberships, total] = await Promise.all([
      prisma.organizationMembership.findMany({
        where: membershipWhere,
        select: {
          id: true,
          memberCode: true,
          status: true,
          user: {
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
              createdAt: true,
              benefitPrograms: true,
              // Org-scoped grants only — never leak grants from other orgs.
              grants: {
                where: { archivedAt: null, organizationId },
                select: {
                  id: true,
                  name: true,
                  status: true,
                  remainingAmount: true,
                },
              },
              inviteTokens: {
                where: { expiresAt: { gt: new Date() } },
                select: { usedAt: true },
                orderBy: { createdAt: "desc" as const },
                take: 1,
              },
            },
          },
        },
        orderBy: { user: { lastName: "asc" } },
        take: limit,
        skip: offset,
      }),
      prisma.organizationMembership.count({ where: membershipWhere }),
    ]);

    // Transform to the same flat shape the UI already consumes. The
    // per-org `memberCode` from the membership row replaces the legacy
    // global `User.beneficiaryCode` for display.
    const result = memberships.map((m) => {
      const b = m.user;
      const activeGrants = b.grants.filter((g) => g.status === "ACTIVE");
      const totalRemaining = b.grants.reduce(
        (sum, g) => sum + Number(g.remainingAmount),
        0,
      );

      const latestToken = b.inviteTokens[0];
      let onboardingStatus: "active" | "pending_password" | "pending_invite" = "pending_invite";
      if (m.status === "active") {
        onboardingStatus = "active";
      } else if (latestToken && !latestToken.usedAt) {
        onboardingStatus = "pending_password";
      }

      return {
        id: b.id,
        // Prefer the per-org memberCode; fall back to legacy beneficiaryCode
        // for old rows that haven't been re-coded for this org.
        beneficiaryCode: m.memberCode || b.beneficiaryCode,
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

    return { data: result, total, limit, offset };
}

// POST /api/beneficiaries — create a new beneficiary
export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    const { session, userId, organizationId } = await requireNonprofitStaff(ROUTE_POST, "POST");

    // Rate limit: 20 requests per minute per user
    const rateLimitResult = rateLimit(
      `beneficiary-create:${userId}`,
      RATE_LIMIT_CONFIGS.beneficiaryCreate,
    );
    if (!rateLimitResult.allowed) {
      return errorResponse({
        kind: "validation",
        message: "Too many requests. Please slow down.",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        },
      });
    }

    const body = await request.json();
    const parsed = createBeneficiarySchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse({
        kind: "validation",
        message: "Validation failed",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
        extraBody: { details: parsed.error.flatten().fieldErrors },
      });
    }

    const data = parsed.data;

    // Validate email against disposable domains and injection attacks
    const emailCheck = validateRecipientEmail(data.email);
    if (!emailCheck.valid) {
      return errorResponse({
        kind: "validation",
        message: emailCheck.reason || "Invalid email address",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
      });
    }

    // Plan limit gate: count active beneficiary *memberships* in this org.
    // We count memberships (not User rows) because at multi-org scale a
    // beneficiary's User.organizationId may point at a different nonprofit
    // while their active beneficiary membership lives here. Counting Users
    // would silently undercount and let an org exceed its beneficiary cap.
    const currentBeneficiaryCount = await prisma.organizationMembership.count({
      where: { organizationId, role: "beneficiary", status: "active" },
    });
    const limitCheck = await checkLimitAccess(
      organizationId,
      "maxBeneficiaries",
      currentBeneficiaryCount,
    );
    if (!limitCheck.allowed) {
      return errorResponse({
        kind: "forbidden",
        message: "Beneficiary limit reached for this period",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
        extraBody: buildLimitReachedResponse("maxBeneficiaries", limitCheck),
      });
    }

    // ------------------------------------------------------------------
    // Multi-org: a single User row can be a beneficiary at many nonprofits.
    // If a user with this email already exists, we link them to THIS org via
    // a new OrganizationMembership instead of returning 409. Their existing
    // profile (DOB, SSN, benefit programs, address) is reused as-is — the
    // requesting admin's form fields are intentionally ignored to avoid
    // overwriting another nonprofit's view of the same person.
    //
    // Cross-org isolation rules in this branch:
    //   - We NEVER reveal which other orgs the user already belongs to.
    //   - We NEVER touch User.organizationId (that's the user's currently
    //     active session org, mutated only by /api/memberships/switch).
    //   - We NEVER overwrite User-level fields (phone, address, DOB).
    //   - Per-org notes / status overrides are out of scope for this PDR
    //     and will need OrganizationMembership-level fields in the future.
    // ------------------------------------------------------------------
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        beneficiaryCode: true,
      },
    });

    if (existing) {
      // The email is taken by SOMEONE on the platform. Determine if linking
      // them as a beneficiary in THIS org is safe.

      // Refuse if the existing user is something incompatible with being
      // a beneficiary (e.g. an internal staff user). Don't reveal the role
      // — a generic 409 is enough to avoid enumeration.
      const compatibleRoles = ["beneficiary", "nonprofit_staff", "vendor"];
      if (!compatibleRoles.includes(existing.role)) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 409 },
        );
      }

      // Already a beneficiary in THIS org? Hard 409.
      const existingMembership = await prisma.organizationMembership.findFirst({
        where: {
          userId: existing.id,
          organizationId,
          role: "beneficiary",
        },
        select: { id: true },
      });
      if (existingMembership) {
        return NextResponse.json(
          { error: "This person is already a beneficiary in your organization" },
          { status: 409 },
        );
      }

      // Link them: new beneficiary membership in this org with a fresh
      // BS- memberCode. status starts at "pending" so the existing
      // accept-invite / activation paths can flip it on first login.
      const memberCode = await generateMembershipCode(prisma, organizationId, "beneficiary");

      await prisma.organizationMembership.create({
        data: {
          userId: existing.id,
          organizationId,
          role: "beneficiary",
          memberCode,
          status: "pending",
          invitedBy: session.user.id,
          isDefaultOrg: false,
        },
      });

      // Audit log scoped to this org only — never references other orgs.
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId,
          action: "link_existing_beneficiary",
          entityType: "user",
          entityId: existing.id,
          newValue: {
            email: existing.email,
            memberCode,
          },
        },
      });

      await incrementUsage(organizationId, "beneficiariesAdded");

      // Invalidate dashboard roll-up so the new membership appears on
      // the admin dashboard immediately. (DDIA Ch5 Replication audit.)
      await invalidateDashboardCache(organizationId);

      return NextResponse.json(
        {
          id: existing.id,
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: existing.email,
          beneficiaryCode: existing.beneficiaryCode,
          memberCode,
          existingUser: true,
          message:
            "This person is already registered on BenefitsSafe. They have been added as a beneficiary in your organization.",
        },
        { status: 201 },
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

    // Get the org-sequence portion from the org's existing orgCode
    // ("ORG-00042" → "0042"). This used to be a full-table scan
    // `organization.count({ createdAt <= now })` which hit 1.8M rows at
    // steady state on every beneficiary create. A PK-by-id lookup is
    // O(1) and returns the same 4-digit sequence. If the org is missing
    // an orgCode (legacy rows), fall back to "0000" so code generation
    // never blocks a signup. (DDIA Ch3 audit.)
    const orgRow = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { orgCode: true },
    });
    const orgSeq = (orgRow?.orgCode?.match(/\d+/)?.[0] ?? "0")
      .padStart(4, "0")
      .slice(-4);

    const beneficiaryCode = `BS-${orgSeq}-${String(beneficiaryCount + 1).padStart(5, "0")}`;

    const createData = {
      email: data.email,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: clean(data.phone),
      role: "beneficiary" as const,
      organizationId,
      beneficiaryCode,
      avatarUrl: data.avatarUrl || null,
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

    // Generate BS-{orgSeq}-{seq} via the shared utility
    const memberCode = await generateMembershipCode(prisma, organizationId, "beneficiary");

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

    // Centralized invite email via email-service (falls back to console log
    // in dev when POSTMARK_API_TOKEN is not set).
    const inviteEmail = buildInviteEmail({
      firstName: beneficiary.firstName,
      orgName: session.user.organizationName,
      inviteUrl,
      loginEmail: beneficiary.email,
      expiresDays: INVITE_EXPIRY_DAYS,
      role: "beneficiary",
    });
    await sendEmail({
      to: beneficiary.email,
      subject: inviteEmail.subject,
      html: inviteEmail.html,
      text: inviteEmail.text,
      orgName: session.user.organizationName,
      userId: session.user.id,
      organizationId,
      emailType: "invite",
    });

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

    // Increment usage counter for this month
    await incrementUsage(organizationId, "beneficiariesAdded");

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

    // Invalidate dashboard roll-up so the new beneficiary shows up on
    // the admin dashboard immediately. (DDIA Ch5 Replication audit.)
    await invalidateDashboardCache(organizationId);

    return NextResponse.json({
      ...beneficiary,
      inviteUrl: process.env.POSTMARK_API_TOKEN ? undefined : inviteUrl,
    }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_POST,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    if (error instanceof GuardDenial) return error.toErrorResponse();
    const err = error as { code?: string; meta?: unknown; message?: string };

    // Handle Prisma unique constraint violation
    if (err.code === "P2002") {
      return errorResponse({
        kind: "conflict",
        message: "A user with this email already exists",
        route: ROUTE_POST,
        method: "POST",
        cause: error,
      });
    }

    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_POST,
      method: "POST",
      cause: error,
    });
  }
}

// ORG-SCOPED: All queries filtered by session.user.organizationId
// GET  /api/vendors — list vendors (paginated, searchable)
// POST /api/vendors — create vendor

import { GuardDenial, requireAuth, requireRole } from "@/lib/auth-guard";
import {
  CACHE_KEYS,
  CACHE_TTL,
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cached,
  cachedWithStaleness,
  hashParams,
  invalidateCacheByPrefix,
  jitterTtl,
} from "@/lib/cache";
import { invalidateDashboardCache } from "@/lib/data";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { validateRecipientEmail, sanitizeEmailForLog, buildSecureLink } from "@/lib/email-security";
import { errorResponse } from "@/lib/error-response";
import { createVendorSchema } from "@/lib/validations/vendor";
import { sendEmail } from "@/lib/services/email-service";
import { buildInviteEmail } from "@/lib/services/email-templates";
import { generateMembershipCode } from "@/lib/utils/membership-code";
import { NextRequest, NextResponse } from "next/server";

const ROUTE_GET = "api/vendors:GET";
const ROUTE_POST = "api/vendors:POST";
const ALLOWED_ROLES = ["nonprofit_admin", "nonprofit_staff", "platform_admin"];
const WRITE_ROLES = ["nonprofit_admin", "platform_admin"];

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth(ROUTE_GET, "GET");
    requireRole(ctx, ALLOWED_ROLES, ROUTE_GET, "GET");
    const { organizationId } = ctx;
    const params = request.nextUrl.searchParams;
    const search = params.get("search")?.trim();
    const status = params.get("status");
    const type = params.get("type");
    const limit = Math.min(parseInt(params.get("limit") || "25"), 100);
    const offset = parseInt(params.get("offset") || "0");

    const where: Record<string, unknown> = {
      organizationId,
      archivedAt: null,
    };

    if (status && status !== "ALL") {
      where.status = status;
    }
    if (type && type !== "ALL") {
      where.type = type;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { id: { contains: search } },
      ];
    }

    // Cache key includes filters and pagination to avoid stale cross-query results
    const perfCacheKey = `${CACHE_KEYS.orgVendors(organizationId)}:${search || ""}:${status || ""}:${type || ""}:${limit}:${offset}`;

    // Layered caches: inner cached() is the P4 perf cache (5min TTL,
    // write-through). Outer cachedWithStaleness adds degraded-mode
    // fallback with a longer max-stale ceiling. Same layering as
    // platform/stats/route.ts.
    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:${organizationId}:vendors:list:${hashParams(request)}`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.LIST.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.LIST.maxStaleSeconds,
      fetcher: () =>
        cached(perfCacheKey, CACHE_TTL.MEDIUM, async () => {
          const [vendors, total] = await Promise.all([
            prisma.vendor.findMany({
              where: where as never,
              select: {
                id: true,
                name: true,
                email: true,
                type: true,
                status: true,
                website: true,
                approvedAt: true,
                createdAt: true,
                user: { select: { avatarUrl: true } },
                _count: { select: { expenses: true } },
              },
              orderBy: { createdAt: "desc" },
              take: limit,
              skip: offset,
            }),
            prisma.vendor.count({ where: where as never }),
          ]);
          return { vendors, total, limit, offset };
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

export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    const ctx = await requireAuth(ROUTE_POST, "POST");
    requireRole(ctx, WRITE_ROLES, ROUTE_POST, "POST");
    const { session, userId, organizationId } = ctx;
    const body = await request.json();
    const parsed = createVendorSchema.safeParse(body);

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

    // For any vendor with an email: create a User account so they can log in
    let createdUserId: string | null = null;

    if (data.email) {
      // Validate email against disposable domains and injection attacks
      const emailCheck = validateRecipientEmail(data.email);
      if (!emailCheck.valid) {
        return errorResponse({
          kind: "validation",
          message: emailCheck.reason || "Invalid email address",
          route: ROUTE_POST,
          method: "POST",
          userId: createdUserId,
          organizationId,
        });
      }

      // Check if a User with this email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true, email: true, firstName: true, lastName: true, organizationId: true },
      });

      if (existingUser) {
        createdUserId = existingUser.id;

        // Create OrganizationMembership if one doesn't exist for this org
        const existingMembership = await prisma.organizationMembership.findFirst({
          where: { userId: existingUser.id, organizationId },
        });

        if (!existingMembership) {
          // Generate VN-{orgSeq}-{seq} via the shared utility
          const memberCode = await generateMembershipCode(prisma, organizationId, "vendor");

          await prisma.organizationMembership.create({
            data: {
              userId: existingUser.id,
              organizationId,
              role: "vendor",
              memberCode,
              status: "active",
              invitedBy: session.user.id,
              isDefaultOrg: false,
            },
          });
        }
      } else {
        // Parse name into firstName/lastName
        const nameParts = data.name.trim().split(/\s+/);
        const firstName = nameParts[0] || data.name;
        const lastName = nameParts.slice(1).join(" ") || "";

        const newUser = await prisma.user.create({
          data: {
            email: data.email,
            firstName,
            lastName,
            phone: data.phone || null,
            role: "vendor",
            organizationId,
            isActive: false,
          },
          select: { id: true, email: true, firstName: true, lastName: true },
        });
        createdUserId = newUser.id;

        // Generate VN-{orgSeq}-{seq} via the shared utility
        const memberCode = await generateMembershipCode(prisma, organizationId, "vendor");

        // Create OrganizationMembership with "pending" status
        await prisma.organizationMembership.create({
          data: {
            userId: newUser.id,
            organizationId,
            role: "vendor",
            memberCode,
            status: "pending",
            invitedBy: session.user.id,
            isDefaultOrg: true,
          },
        });

        // Create InviteToken with 7-day expiry
        const INVITE_EXPIRY_DAYS = 7;
        const tokenExpiresAt = new Date();
        tokenExpiresAt.setDate(tokenExpiresAt.getDate() + INVITE_EXPIRY_DAYS);

        const invite = await prisma.inviteToken.create({
          data: {
            userId: newUser.id,
            sentTo: data.email,
            method: "email",
            sentById: session.user.id,
            expiresAt: tokenExpiresAt,
          },
          select: { token: true, expiresAt: true },
        });

        const inviteUrl = buildSecureLink(`/auth/accept-invite?token=${invite.token}`);

        // Centralized invite email via email-service.
        const vendorInviteEmail = buildInviteEmail({
          firstName,
          orgName: session.user.organizationName,
          inviteUrl,
          loginEmail: data.email,
          expiresDays: INVITE_EXPIRY_DAYS,
          role: "vendor",
        });
        const vendorSendResult = await sendEmail({
          to: data.email,
          subject: vendorInviteEmail.subject,
          html: vendorInviteEmail.html,
          text: vendorInviteEmail.text,
          orgName: session.user.organizationName,
          userId: session.user.id,
          organizationId,
          emailType: "invite",
        });
        const emailSent = vendorSendResult.sent || vendorSendResult.skipped;

        // Audit log for the invite
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            organizationId,
            action: "invite",
            entityType: "vendor",
            entityId: newUser.id,
            newValue: JSON.parse(JSON.stringify({
              email: sanitizeEmailForLog(data.email),
              role: "vendor",
              vendorName: data.name,
              emailSent,
            })),
          },
        });
      }
    }

    // Generate vendorCode: VN-{orgSeq}-{vendorSeq}
    // Extract orgSeq from the organization's orgCode, or fall back to counting
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { orgCode: true },
    });

    let orgSeq = "0000";
    if (org?.orgCode) {
      const match = org.orgCode.match(/ORG-(\d+)/);
      if (match) {
        orgSeq = match[1];
      }
    }

    // Race-safe vendorCode + create. The previous version used a simple
    // count() then string-formatted the next sequence — two concurrent
    // POSTs in the same org would both observe count=N and both try to
    // write VN-X-N+1, hitting the @unique constraint and 500ing one of
    // the requests. We now compute the next code from the *current max*
    // (which respects gaps from prior failed attempts) and wrap the
    // create() in a retry loop that catches Prisma P2002 unique-violation
    // errors. On retry we re-read the max so the second attempt sees
    // the row that won the race.
    const codePrefix = `VN-${orgSeq}-`;
    let vendor: { id: string; name: string; vendorCode: string | null; status: string; userId: string | null } | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const maxVendor = await prisma.vendor.findFirst({
        where: { organizationId, vendorCode: { startsWith: codePrefix } },
        orderBy: { vendorCode: "desc" },
        select: { vendorCode: true },
      });
      const lastSeq = maxVendor?.vendorCode
        ? parseInt(maxVendor.vendorCode.split("-").pop() || "0", 10) || 0
        : 0;
      const candidateCode = `${codePrefix}${String(lastSeq + 1).padStart(5, "0")}`;

      try {
        vendor = await prisma.vendor.create({
          data: {
            organizationId,
            name: data.name,
            vendorCode: candidateCode,
            email: data.email || null,
            type: data.type,
            phone: data.phone || null,
            website: data.website || null,
            address: data.address || null,
            paymentMethod: data.paymentMethod || null,
            taxIdCollected: data.taxIdCollected || false,
            form1099Required: data.form1099Required || false,
            userId: createdUserId,
          },
          select: { id: true, name: true, vendorCode: true, status: true, userId: true },
        });
        break;
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === "P2002" && attempt < 2) {
          // unique-constraint collision on vendorCode — retry with a fresh max.
          lastErr = e;
          continue;
        }
        throw e;
      }
    }
    if (!vendor) {
      throw lastErr ?? new Error("Failed to assign a unique vendorCode after 3 attempts");
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "create",
        entityType: "vendor",
        entityId: vendor.id,
        newValue: JSON.parse(JSON.stringify({ name: data.name, type: data.type })),
      },
    });

    // Invalidate all cached vendor listings for this org
    await invalidateCacheByPrefix(CACHE_KEYS.orgVendors(organizationId));
    // And the dashboard roll-up — see DDIA Ch5 Replication audit.
    await invalidateDashboardCache(organizationId);

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
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
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_POST,
      method: "POST",
      cause: error,
    });
  }
}

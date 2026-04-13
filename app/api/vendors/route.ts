// ORG-SCOPED: All queries filtered by session.user.organizationId
// GET  /api/vendors — list vendors (paginated, searchable)
// POST /api/vendors — create vendor

import { auth } from "@/auth";
import { cached, invalidateCacheByPrefix, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { validateRecipientEmail, sanitizeEmailForLog, buildSecureLink } from "@/lib/email-security";
import { createVendorSchema } from "@/lib/validations/vendor";
import { generateMembershipCode } from "@/lib/utils/membership-code";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ROLES = ["nonprofit_admin", "nonprofit_staff", "platform_admin"];
const WRITE_ROLES = ["nonprofit_admin", "platform_admin"];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { organizationId } = session.user;
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
    const cacheKey = `${CACHE_KEYS.orgVendors(organizationId)}:${search || ""}:${status || ""}:${type || ""}:${limit}:${offset}`;

    const result = await cached(cacheKey, CACHE_TTL.MEDIUM, async () => {
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
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/vendors error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!WRITE_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { organizationId } = session.user;
    const body = await request.json();
    const parsed = createVendorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // For any vendor with an email: create a User account so they can log in
    let userId: string | null = null;

    if (data.email) {
      // Validate email against disposable domains and injection attacks
      const emailCheck = validateRecipientEmail(data.email);
      if (!emailCheck.valid) {
        return NextResponse.json(
          { error: emailCheck.reason || "Invalid email address" },
          { status: 400 },
        );
      }

      // Check if a User with this email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true, email: true, firstName: true, lastName: true, organizationId: true },
      });

      if (existingUser) {
        userId = existingUser.id;

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
        userId = newUser.id;

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

        // Send invite email via Postmark (or console fallback)
        let emailSent = false;

        if (process.env.POSTMARK_API_TOKEN) {
          try {
            const emailRes = await fetch("https://api.postmarkapp.com/email", {
              method: "POST",
              headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-Postmark-Server-Token": process.env.POSTMARK_API_TOKEN,
              },
              body: JSON.stringify({
                From: process.env.POSTMARK_FROM_EMAIL || "noreply@benefitssafe.com",
                To: data.email,
                Subject: "You've been invited to BenefitsSafe as a Vendor",
                TextBody: `Hi ${firstName},\n\nYou've been invited to join BenefitsSafe as a vendor.\n\nSet up your account: ${inviteUrl}\n\nThis link expires in ${INVITE_EXPIRY_DAYS} days.`,
                MessageStream: "outbound",
                Headers: [
                  { Name: "X-BenefitsSafe-Invite", Value: "true" },
                ],
              }),
            });

            emailSent = emailRes.ok;
            if (!emailRes.ok) {
              console.error("Postmark vendor invite email failed:", await emailRes.text());
            }
          } catch (emailError) {
            console.error("Failed to send vendor invite email:", emailError);
          }
        } else {
          // Log to console when Postmark not configured (dev mode)
          console.log("\n========================================");
          console.log("VENDOR INVITE (Postmark not configured)");
          console.log("========================================");
          console.log(`To: ${data.email}`);
          console.log(`Name: ${firstName} ${lastName}`);
          console.log(`Role: vendor`);
          console.log(`Link: ${inviteUrl}`);
          console.log(`Expires: ${invite.expiresAt.toISOString()}`);
          console.log("========================================\n");
          emailSent = true; // In dev, console log counts as "sent"
        }

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
      // orgCode format is "ORG-00001", extract the numeric part
      const match = org.orgCode.match(/ORG-(\d+)/);
      if (match) {
        orgSeq = match[1];
      }
    }

    const vendorCount = await prisma.vendor.count({
      where: { organizationId },
    });
    const vendorCode = `VN-${orgSeq}-${String(vendorCount + 1).padStart(5, "0")}`;

    const vendor = await prisma.vendor.create({
      data: {
        organizationId,
        name: data.name,
        vendorCode,
        email: data.email || null,
        type: data.type,
        phone: data.phone || null,
        website: data.website || null,
        address: data.address || null,
        paymentMethod: data.paymentMethod || null,
        taxIdCollected: data.taxIdCollected || false,
        form1099Required: data.form1099Required || false,
        userId,
      },
      select: { id: true, name: true, vendorCode: true, status: true, userId: true },
    });

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

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error("POST /api/vendors error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

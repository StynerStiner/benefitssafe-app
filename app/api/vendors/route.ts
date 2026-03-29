// ORG-SCOPED: All queries filtered by session.user.organizationId
// GET  /api/vendors — list vendors (paginated, searchable)
// POST /api/vendors — create vendor

import { auth } from "@/auth";
import { cached, invalidateCacheByPrefix, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { createVendorSchema } from "@/lib/validations/vendor";
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

    // For freelancers with email: auto-create a User record with vendor role
    let userId: string | null = null;
    if (data.type === "SERVICE_PROVIDER" && data.email) {
      // Check if user with this email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true },
      });

      if (existingUser) {
        userId = existingUser.id;
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
            isActive: true,
          },
          select: { id: true },
        });
        userId = newUser.id;
      }
    }

    const vendor = await prisma.vendor.create({
      data: {
        organizationId,
        name: data.name,
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
      select: { id: true, name: true, status: true, userId: true },
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

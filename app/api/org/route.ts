import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/org — Get current user's organization details
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 404 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        name: true,
        ein: true,
        einVerified: true,
        address: true,
        phone: true,
        website: true,
        logoUrl: true,
        stripeAccountId: true,
        stripeFinancialAccountId: true,
        subscriptionStatus: true,
        createdAt: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Parse address into parts for the form (stored as "street, city, state zip")
    let addressStreet = "";
    let addressCity = "";
    let addressState = "";
    let addressZip = "";
    if (org.address) {
      const parts = org.address.split(",").map((p) => p.trim());
      addressStreet = parts[0] || "";
      addressCity = parts[1] || "";
      const stateZip = (parts[2] || "").split(" ").filter(Boolean);
      addressState = stateZip[0] || "";
      addressZip = stateZip[1] || "";
    }

    return NextResponse.json({
      ...org,
      email: null, // Organization doesn't have email field — use admin's email
      addressStreet,
      addressCity,
      addressState,
      addressZip,
    });
  } catch (error) {
    console.error("GET /api/org error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/org — Update organization details
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 404 });
    }

    if (user.role !== "nonprofit_admin" && user.role !== "platform_admin") {
      return NextResponse.json({ error: "Only admins can update organization" }, { status: 403 });
    }

    const body = await request.json();
    const { name, phone, website, addressStreet, addressCity, addressState, addressZip } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    // Combine address parts into single string
    const addressParts = [addressStreet, addressCity, [addressState, addressZip].filter(Boolean).join(" ")].filter(Boolean);
    const address = addressParts.length > 0 ? addressParts.join(", ") : null;

    const updated = await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        website: website?.trim() || null,
        address,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: user.organizationId,
        action: "update",
        entityType: "organization",
        entityId: updated.id,
        newValue: { name: updated.name, phone: updated.phone, website: updated.website, address: updated.address },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/org error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

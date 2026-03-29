import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { uploadDocumentToS3 } from "@/lib/s3-upload";
import { createDocumentSchema } from "@/lib/validations/document";
import { NextRequest, NextResponse } from "next/server";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf"];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(params.get("limit") || "25", 10) || 25, 100);
    const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

    const where = { organizationId: session.user.organizationId };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.document.count({ where }),
    ]);

    return NextResponse.json({ documents, total, limit, offset });
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string | null;
    const entityId = formData.get("entityId") as string | null;
    const fileType = (formData.get("fileType") as string) || "receipt";

    // Validate metadata fields with Zod
    const parsed = createDocumentSchema.safeParse({ entityType, entityId, fileType });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
    }

    const data = parsed.data;

    // Upload to S3
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileUrl = await uploadDocumentToS3(buffer, data.entityId, file.name, file.type);

    // Create document record in database
    const document = await prisma.document.create({
      data: {
        organizationId: session.user.organizationId,
        entityType: data.entityType,
        entityId: data.entityId,
        fileName: file.name,
        fileUrl,
        fileType: data.fileType,
        uploadedById: session.user.id,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        action: "upload_document",
        entityType: data.entityType,
        entityId: data.entityId,
        newValue: {
          fileName: file.name,
          fileType: data.fileType,
          documentId: document.id,
        },
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("POST /api/documents error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

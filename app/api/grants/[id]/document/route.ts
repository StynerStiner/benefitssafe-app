// POST /api/grants/[id]/document — Upload or paste grant document text
// Accepts multipart form (PDF file) or JSON (pasted text)

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify grant exists and belongs to org
    const grant = await prisma.grant.findFirst({
      where: { id, organizationId, archivedAt: null },
      select: { id: true },
    });

    if (!grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") || "";

    let documentText = "";
    let documentName = "";

    if (contentType.includes("multipart/form-data")) {
      // Handle PDF upload
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
      }

      documentName = file.name;

      // Parse PDF to text
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      try {
        // Dynamic import to avoid bundling issues
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
        const pdfData = await pdfParse(buffer);
        documentText = pdfData.text;
      } catch (pdfError) {
        console.error("PDF parse error:", pdfError);
        return NextResponse.json(
          { error: "Failed to extract text from PDF. Please paste the text instead." },
          { status: 422 },
        );
      }
    } else {
      // Handle JSON (pasted text)
      const body = await request.json();
      if (!body.text || typeof body.text !== "string") {
        return NextResponse.json({ error: "text field is required" }, { status: 400 });
      }
      documentText = body.text;
      documentName = body.name || "Pasted text";
    }

    if (!documentText.trim()) {
      return NextResponse.json({ error: "Document contains no extractable text" }, { status: 422 });
    }

    // Save to grant
    await prisma.grant.update({
      where: { id },
      data: {
        grantDocumentText: documentText,
        grantDocumentName: documentName,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "upload_document",
        entityType: "grant",
        entityId: id,
        newValue: JSON.parse(JSON.stringify({
          documentName,
          textLength: documentText.length,
        })),
      },
    });

    return NextResponse.json({
      message: "Grant document saved",
      documentName,
      textLength: documentText.length,
    });
  } catch (error) {
    console.error("POST /api/grants/[id]/document error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/grants/[id]/document — Remove grant document
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.grant.update({
      where: { id },
      data: {
        grantDocumentText: null,
        grantDocumentName: null,
      },
    });

    return NextResponse.json({ message: "Document removed" });
  } catch (error) {
    console.error("DELETE /api/grants/[id]/document error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

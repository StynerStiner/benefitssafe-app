import { GuardDenial, requireAuth } from "@/lib/auth-guard";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  hashParams,
  jitterTtl,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { uploadDocumentToS3 } from "@/lib/s3-upload";
import { createDocumentSchema } from "@/lib/validations/document";
import { NextRequest, NextResponse } from "next/server";

const ROUTE_GET = "api/documents:GET";
const ROUTE_POST = "api/documents:POST";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf"];

export async function GET(request: NextRequest) {
  try {
    const { userId, organizationId, role } = await requireAuth(ROUTE_GET, "GET");

    const params = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(params.get("limit") || "25", 10) || 25, 100);
    const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

    const where: Record<string, unknown> = { organizationId };

    // Beneficiaries can only see their own documents
    if (role === "beneficiary") {
      where.OR = [
        { entityType: "beneficiary", entityId: userId },
        { uploadedById: userId },
      ];
    }

    const cacheKey = `${STALE_CACHE_KEY_PREFIX}:${organizationId}:documents:list:${role}:${userId}:${hashParams(request)}`;
    const staleResult = await cachedWithStaleness({
      key: cacheKey,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.LIST.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.LIST.maxStaleSeconds,
      fetcher: async () => {
        const [documents, total] = await Promise.all([
          prisma.document.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
          }),
          prisma.document.count({ where }),
        ]);
        return { documents, total, limit, offset };
      },
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
    const { userId, organizationId } = await requireAuth(ROUTE_POST, "POST");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string | null;
    const entityId = formData.get("entityId") as string | null;
    const fileType = (formData.get("fileType") as string) || "receipt";

    // Validate metadata fields with Zod
    const parsed = createDocumentSchema.safeParse({ entityType, entityId, fileType });
    if (!parsed.success) {
      return errorResponse({
        kind: "validation",
        message: "Validation failed",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
        extraBody: { details: parsed.error.flatten() },
      });
    }

    if (!file) {
      return errorResponse({
        kind: "validation",
        message: "No file provided",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
      });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse({
        kind: "validation",
        message: "Only PDF files are supported",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
      });
    }

    if (file.size > MAX_SIZE) {
      return errorResponse({
        kind: "validation",
        message: "File must be under 10MB",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
      });
    }

    const data = parsed.data;

    // Upload to S3 — namespaced by the caller's organizationId so two
    // different nonprofits cannot collide on entityId-based keys and
    // structurally isolate documents at the bucket prefix level.
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileUrl = await uploadDocumentToS3(
      buffer,
      organizationId,
      data.entityId,
      file.name,
      file.type,
    );

    // Create document record in database
    const document = await prisma.document.create({
      data: {
        organizationId,
        entityType: data.entityType,
        entityId: data.entityId,
        fileName: file.name,
        fileUrl,
        fileType: data.fileType,
        uploadedById: userId,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
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
    // Never expose internal error messages to the client (A05)
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_POST,
      method: "POST",
      cause: error,
    });
  }
}

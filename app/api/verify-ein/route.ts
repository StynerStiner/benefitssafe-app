import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { verifyEIN } from "@/lib/ein-verify";
import { errorResponse } from "@/lib/error-response";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const ROUTE = "api/verify-ein:POST";

const verifyEINSchema = z.object({
  ein: z.string().regex(/^\d{2}-?\d{7}$/, "EIN must be 9 digits (format: XX-XXXXXXX)"),
});

// Rate limit config: 10 requests per minute per IP
const EIN_VERIFY_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60000,
};

export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    // Rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateLimitResult = rateLimit(
      `ein-verify:${ip}`,
      EIN_VERIFY_RATE_LIMIT
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many verification requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (rateLimitResult.resetAt.getTime() - Date.now()) / 1000
            ).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const parsed = verifyEINSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await verifyEIN(parsed.data.ein);

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    console.error("POST /api/verify-ein error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

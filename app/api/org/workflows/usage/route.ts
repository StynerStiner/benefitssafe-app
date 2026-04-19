import { auth } from "@/auth";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  jitterTtl,
} from "@/lib/cache";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";
import { getComposioUsage } from "@/lib/composio-usage";

const ROUTE_GET = "api/org/workflows/usage:GET";

// GET /api/org/workflows/usage -- Platform admin view of Composio usage
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use session-level role so Aurora is not hit before the cache read.
    const role = session.user.role;
    // Only platform admins and nonprofit admins can see usage
    if (role !== "platform_admin" && role !== "nonprofit_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Usage is fetched from Composio (external) but the authorization
    // check above does hit Aurora via the role claim — without this
    // cache, every degraded-mode request would still fall through. The
    // cache key is platform-scoped because getComposioUsage() returns
    // the same platform-wide counters regardless of who asked.
    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:platform:workflows:usage:default`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.ORG_SETTINGS.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.ORG_SETTINGS.maxStaleSeconds,
      fetcher: () => getComposioUsage(),
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

    // Opaque usage object — header-only staleness indicator so we don't
    // collide with fields getComposioUsage() may add later.
    const headers: Record<string, string> = {};
    if (staleResult.kind === "stale") {
      headers["X-Data-Staleness"] = String(staleResult.staleSeconds);
    }

    return NextResponse.json(staleResult.data, { headers });
  } catch (error) {
    console.error("GET /api/org/workflows/usage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

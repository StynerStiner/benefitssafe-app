import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Public routes that do not require authentication
const PUBLIC_PATHS = [
  "/auth",
  "/api/auth",
  "/api/health",
  "/api/verify-ein",
  "/api/promo-codes/verify",
  "/api/webhooks",
  "/api/billing/checkout-direct",
  "/_next",
  "/public",
  "/favicon.ico",
  "/icon",
  "/apple-icon",
  "/manifest",
  "/robots.txt",
  "/sitemap.xml",
  "/privacy",
  "/terms",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((prefix) => pathname.startsWith(prefix));
}

// Web Crypto API fingerprint hash (Edge Runtime compatible — no Node.js crypto)
async function hashFingerprint(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through without auth check
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for valid session token
  // NextAuth v5 uses AUTH_SECRET, try both env var names
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  const token = await getToken({
    req: request,
    secret,
    // NextAuth v5 uses a different cookie name format
    cookieName: process.env.NODE_ENV === "production"
      ? "__Secure-authjs.session-token"
      : "authjs.session-token",
  });

  let authToken = token;

  if (!authToken) {
    // Try the legacy cookie name as fallback
    authToken = await getToken({
      req: request,
      secret,
      cookieName: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
    });

    if (!authToken) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", encodeURI(request.url));
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- Trial / subscription enforcement (JWT-based, Edge-compatible) ---
  // Billing routes and account/session routes are always allowed through
  // so the user can upgrade even if their trial has expired.
  const BILLING_EXEMPT_PREFIXES = [
    "/settings/billing",
    "/api/billing",
    "/api/memberships/switch",
    "/api/org",
    "/api/user",
    "/api/notifications",
  ];
  const isBillingExempt = BILLING_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));

  // Platform admins (BenefitsSafe internal staff) bypass trial enforcement
  const tokenRole = authToken.role as string | undefined;
  const isPlatformAdmin = tokenRole === "platform_admin";

  if (!isBillingExempt && !isPlatformAdmin) {
    const subscriptionStatus = authToken.subscriptionStatus as string | undefined;
    const trialEndDateStr = authToken.trialEndDate as string | null | undefined;
    const billingStatus = authToken.billingStatus as string | null | undefined;

    const now = Date.now();
    const trialEndMs = trialEndDateStr ? new Date(trialEndDateStr).getTime() : null;
    // Trial is active if status === "trial" and either no end date set yet (brand-new org)
    // or the end date is still in the future.
    const trialActive =
      subscriptionStatus === "trial" && (trialEndMs === null || trialEndMs > now);
    const billingActive =
      billingStatus === "active" || billingStatus === "trialing";

    if (!trialActive && !billingActive) {
      // Trial expired and no active paid plan → block
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            error: "Trial expired. Upgrade to continue.",
            upgradeUrl: "/settings/billing",
          },
          { status: 402 },
        );
      }
      // Page navigation → redirect to billing settings
      if (!pathname.startsWith("/settings/billing")) {
        return NextResponse.redirect(new URL("/settings/billing", request.url));
      }
    }
  }

  // --- Role-based route enforcement ---
  const role = tokenRole;
  if (role && !pathname.startsWith("/api/")) {
    const routePermissions: Record<string, string[]> = {
      "/dashboard": ["nonprofit_admin", "nonprofit_staff", "platform_admin"],
      "/grants": ["nonprofit_admin", "nonprofit_staff", "beneficiary", "auditor", "attorney", "grant_officer", "platform_admin"],
      "/beneficiaries": ["nonprofit_admin", "nonprofit_staff", "grant_officer", "platform_admin"],
      "/expenses": ["nonprofit_admin", "nonprofit_staff", "beneficiary", "auditor", "attorney", "grant_officer", "compliance_officer", "platform_admin"],
      "/vendors": ["nonprofit_admin", "platform_admin"],
      "/virtual-cards": ["nonprofit_admin", "beneficiary", "platform_admin"],
      "/subscriptions": ["nonprofit_admin", "beneficiary", "platform_admin"],
      "/reports": ["nonprofit_admin", "cpa", "auditor", "grant_officer", "compliance_officer", "platform_admin"],
      "/users": ["nonprofit_admin", "platform_admin"],
      "/policies": ["nonprofit_admin", "platform_admin"],
      "/settings": ["nonprofit_admin", "platform_admin"],
      "/my-dashboard": ["beneficiary", "nonprofit_admin", "platform_admin"],
      "/my-documents": ["beneficiary", "nonprofit_admin", "platform_admin"],
      "/documents": ["nonprofit_admin", "beneficiary", "auditor", "attorney", "grant_officer", "platform_admin"],
      "/audit-trail": ["cpa", "auditor", "attorney", "support_agent", "compliance_officer", "platform_admin", "nonprofit_admin"],
      "/compliance": ["cpa", "auditor", "attorney", "compliance_officer", "platform_admin"],
      "/vendor-dashboard": ["vendor", "platform_admin"],
      "/invoices": ["vendor", "platform_admin"],
      "/platform": ["platform_admin"],
      "/customers": ["platform_admin", "support_agent"],
    };

    const defaultRoutes: Record<string, string> = {
      nonprofit_admin: "/dashboard",
      nonprofit_staff: "/dashboard",
      beneficiary: "/my-dashboard",
      cpa: "/reports",
      auditor: "/audit-trail",
      vendor: "/vendor-dashboard",
      attorney: "/compliance",
      grant_officer: "/grants",
      platform_admin: "/customers",
      support_agent: "/support",
      compliance_officer: "/compliance",
      billing_admin: "/billing",
    };

    for (const [route, allowedRoles] of Object.entries(routePermissions)) {
      if (pathname === route || pathname.startsWith(route + "/")) {
        if (!allowedRoles.includes(role)) {
          const defaultRoute = defaultRoutes[role] || "/dashboard";
          return NextResponse.redirect(new URL(defaultRoute, request.url));
        }
        break;
      }
    }
  }

  // --- Session fingerprinting: detect stolen session cookies ---
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const fingerprint = await hashFingerprint(ip + userAgent);

  const existingFp = request.cookies.get("bs-device-fp")?.value;
  const response = NextResponse.next();

  if (!existingFp) {
    // First visit after login: store the device fingerprint
    response.cookies.set("bs-device-fp", fingerprint, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  } else if (existingFp !== fingerprint) {
    // Fingerprint mismatch -- check if this is a sensitive route
    const sensitivePatterns = [
      "/api/virtual-cards",
      "/api/expenses",
      "/api/grants",
      "/api/ledger",
      "/api/vendors",
      "/api/stripe",
      "/api/policies",
      "/api/org",
      "/api/organization",
      "/api/user",
    ];
    const isSensitive = sensitivePatterns.some((pattern) => pathname.startsWith(pattern));
    if (isSensitive) {
      response.headers.set("x-session-suspicious", "fingerprint-mismatch");
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest|public/).*)"],
};

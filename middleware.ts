import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Public routes that do not require authentication
const PUBLIC_PATHS = [
  "/auth",
  "/api/auth",
  "/api/verify-ein",
  "/api/promo-codes/verify",
  "/_next",
  "/public",
  "/favicon.ico",
  "/privacy",
  "/terms",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((prefix) => pathname.startsWith(prefix));
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

  if (!token) {
    // Try the legacy cookie name as fallback
    const legacyToken = await getToken({
      req: request,
      secret,
      cookieName: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
    });

    if (!legacyToken) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", encodeURI(request.url));
      return NextResponse.redirect(loginUrl);
    }
  }

  // User is authenticated -- proceed
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|public/).*)"],
};

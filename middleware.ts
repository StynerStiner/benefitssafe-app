import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Public routes that do not require authentication
const PUBLIC_PATHS = [
  "/auth",
  "/api/auth",
  "/_next",
  "/public",
  "/favicon.ico",
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
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    // Build the login redirect URL, preserving the intended destination
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", encodeURI(request.url));
    return NextResponse.redirect(loginUrl);
  }

  // If MFA is pending, only allow MFA-related and auth routes
  if (token.mfaPending) {
    const allowedMfaPaths = ["/api/mfa/verify", "/api/auth", "/auth"];
    const isAllowedDuringMfa = allowedMfaPaths.some((p) =>
      pathname.startsWith(p),
    );
    if (!isAllowedDuringMfa) {
      // Redirect to login so the MFA step can be completed
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("mfaPending", "true");
      return NextResponse.redirect(loginUrl);
    }
  }

  // User is authenticated -- proceed
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|public/).*)"],
};

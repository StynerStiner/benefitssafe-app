import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "./auth";

const publicRoutes = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/create-password",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/manifest.json")
  ) {
    return NextResponse.next();
  }

  let session = null;

  try {
    session = await auth();
  } catch (error) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  const isPublic = publicRoutes.some((route) => pathname.startsWith(route));

  if (!session?.user && !isPublic) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return NextResponse.next();
}

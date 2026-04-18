import { prisma } from "@/lib/db";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { loginSchema } from "./lib/zod";
import type { UserRole } from "@/lib/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
      role: UserRole;
      organizationId: string;
      organizationName: string;
      subscriptionStatus: string;
      trialEndDate: string | null;
      billingTier: string;
      billingStatus: string | null;
      image?: string | null;
      mfaPending?: boolean;
    };
  }

  interface User {
    role: UserRole;
    organizationId: string;
    mfaPending?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    image?: string | null;
    role: UserRole;
    organizationId: string;
    organizationName: string;
    subscriptionStatus: string;
    trialEndDate: string | null;
    billingTier: string;
    billingStatus: string | null;
    mfaPending?: boolean;
  }
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Explicit cookie configuration. NextAuth defaults would mostly do the
// right thing here, but "mostly" is not acceptable for a fintech auth
// cookie — be loud about every flag so a future library upgrade cannot
// silently weaken session security.
//
//   - httpOnly      : true  — never readable by client JS, so XSS cannot
//                              exfiltrate the session token
//   - secure        : true in prod — only ever sent over HTTPS
//   - sameSite: lax : blocks cross-site POST CSRF but still lets the
//                     cookie ride along on normal top-level navigations
//                     (needed for OAuth provider redirects to work)
//   - __Secure-     : prefixed cookie name in prod, which browsers refuse
//                     to set from a non-HTTPS origin (belt + suspenders)
//
// The three secondary cookies (callbackUrl, csrfToken, pkceCodeVerifier)
// are locked down with the same flag set so NextAuth's built-in CSRF
// protection cannot be downgraded by an older browser or a proxy that
// strips the default cookie prefix.
const AUTH_COOKIES = {
  sessionToken: {
    name: IS_PRODUCTION ? "__Secure-authjs.session-token" : "authjs.session-token",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: IS_PRODUCTION,
    },
  },
  callbackUrl: {
    name: IS_PRODUCTION ? "__Secure-authjs.callback-url" : "authjs.callback-url",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: IS_PRODUCTION,
    },
  },
  csrfToken: {
    name: IS_PRODUCTION ? "__Host-authjs.csrf-token" : "authjs.csrf-token",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: IS_PRODUCTION,
    },
  },
  pkceCodeVerifier: {
    name: IS_PRODUCTION ? "__Secure-authjs.pkce.code_verifier" : "authjs.pkce.code_verifier",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: IS_PRODUCTION,
      maxAge: 60 * 15,
    },
  },
  state: {
    name: IS_PRODUCTION ? "__Secure-authjs.state" : "authjs.state",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: IS_PRODUCTION,
      maxAge: 60 * 15,
    },
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 3600, // 1 hour — sessions expire after 60 minutes of inactivity
    updateAge: 900, // Refresh token every 15 minutes of active use
  },
  cookies: AUTH_COOKIES,
  // Trust the X-Forwarded-Host header set by Vercel. Required for the
  // __Host- / __Secure- cookie prefixes to work behind Vercel's proxy.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        try {
          const { email, password } = await loginSchema.parseAsync(credentials);

          // Rate limit login attempts per email
          const rateLimitKey = `login:${email}`;
          const limitResult = rateLimit(rateLimitKey, RATE_LIMIT_CONFIGS.loginAttempt);
          if (!limitResult.allowed) {
            throw new Error("Too many login attempts. Please try again in 15 minutes.");
          }

          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              passwordHash: true,
              avatarUrl: true,
              role: true,
              organizationId: true,
              isActive: true,
              mfaEnabled: true,
              emailVerified: true,
            },
          });

          if (!user || !user.passwordHash || !user.isActive) {
            // Log failed login - user not found or inactive
            prisma.auditLog.create({
              data: {
                userId: "anonymous",
                organizationId: user?.organizationId || "unknown",
                action: "login_failed",
                entityType: "auth",
                entityId: email,
                newValue: { reason: !user ? "User not found" : !user.passwordHash ? "No password set" : "Account inactive" },
              },
            }).catch(() => {});
            return null;
          }

          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            // Log failed login - wrong password
            prisma.auditLog.create({
              data: {
                userId: user.id,
                organizationId: user.organizationId,
                action: "login_failed",
                entityType: "auth",
                entityId: email,
                newValue: { reason: "Invalid password" },
              },
            }).catch(() => {});
            return null;
          }

          // Check email verification status
          if (!user.emailVerified) {
            throw new Error("EMAIL_NOT_VERIFIED");
          }

          // Record login device fingerprint (fire-and-forget)
          prisma.user.update({
            where: { id: user.id },
            data: {
              lastLoginAt: new Date(),
              // IP and userAgent will be set by middleware on next request
            },
          }).catch(() => {});

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            organizationId: user.organizationId,
            mfaPending: user.mfaEnabled,
          };
        } catch (error) {
          if (error instanceof Error && error.message === "EMAIL_NOT_VERIFIED") {
            throw error;
          }
          return null;
        }
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      issuer: "https://login.microsoftonline.com/common/v2.0",
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session: updateSession }) {
      if (user) {
        token.id = user.id as string;
        token.firstName = (user as unknown as { firstName: string }).firstName;
        token.lastName = (user as unknown as { lastName: string }).lastName;
        token.avatarUrl = (user as unknown as { avatarUrl: string | null }).avatarUrl;
        // Authoritative avatar lookup from DB — ensures OAuth providers (Google,
        // Microsoft) and Credentials login all populate token.image consistently.
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id as string },
            select: { avatarUrl: true },
          });
          token.image = dbUser?.avatarUrl ?? null;
          token.avatarUrl = dbUser?.avatarUrl ?? token.avatarUrl ?? null;
        } catch {
          token.image = token.avatarUrl ?? null;
        }
        token.organizationId = user.organizationId;

        // Use the membership role for this org if it exists, otherwise fall back to user.role
        // This ensures multi-org users get the correct role per org.
        //
        // BSRS Ch 5 P3 gate (α): filter out memberships whose time-boxed grant
        // has expired or been revoked. An expired/revoked membership is
        // treated as if it didn't exist, so effectiveRole falls through to
        // User.role (typically a non-privileged role like `cpa`). The hybrid
        // β check in lib/auth-guard.ts#requirePlatformAdmin adds a per-request
        // DB re-check for breakglass tightness; non-platform-admin roles
        // rely on this α gate alone and tolerate the ≤15-min JWT staleness
        // window set by updateAge.
        let effectiveRole = user.role;
        try {
          const membership = await prisma.organizationMembership.findFirst({
            where: {
              userId: user.id as string,
              organizationId: user.organizationId,
              status: "active",
              revokedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: { role: true },
          });
          if (membership?.role) {
            effectiveRole = membership.role as typeof effectiveRole;
          }
        } catch {
          // Fall back to user.role if membership lookup fails
        }
        token.role = effectiveRole;
        token.mfaPending = user.mfaPending ?? false;

        // Fetch organization name + billing fields for session display and middleware gates
        try {
          const org = await prisma.organization.findUnique({
            where: { id: user.organizationId },
            select: {
              name: true,
              subscriptionStatus: true,
              trialEndDate: true,
              billingSubscription: { select: { tier: true, status: true } },
            },
          });
          token.organizationName = org?.name || "";
          token.subscriptionStatus = org?.subscriptionStatus || "trial";
          token.trialEndDate = org?.trialEndDate ? org.trialEndDate.toISOString() : null;
          token.billingTier = org?.billingSubscription?.tier || "free";
          token.billingStatus = org?.billingSubscription?.status ?? null;
        } catch (error) {
          console.error("JWT callback: org lookup failed for", user.organizationId, error);
          token.organizationName = "";
          token.subscriptionStatus = "trial";
          token.trialEndDate = null;
          token.billingTier = "free";
          token.billingStatus = null;
        }
      }
      // Allow clearing mfaPending via session update after MFA verification
      if (trigger === "update" && updateSession?.mfaPending === false) {
        token.mfaPending = false;
      }
      // Refresh avatarUrl from DB when client calls updateSession({ image })
      // after a successful avatar upload. Re-reads DB to stay authoritative.
      if (trigger === "update" && updateSession?.image !== undefined) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { avatarUrl: true },
          });
          token.image = dbUser?.avatarUrl ?? null;
          token.avatarUrl = dbUser?.avatarUrl ?? null;
        } catch {
          // Keep existing values on DB error
        }
      }
      // Refresh the active org on session update. Used by the platform-admin
      // org picker: after POST /api/platform/switch-org mutates
      // User.organizationId on the DB row, the client calls
      // useSession().update({ refreshOrg: true }) so the JWT re-reads the new
      // org + its display name. Role is intentionally NOT re-read — a platform
      // admin stays platform_admin regardless of which tenant they are viewing.
      if (trigger === "update" && updateSession?.refreshOrg === true) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              organizationId: true,
              organization: {
                select: {
                  name: true,
                  subscriptionStatus: true,
                  trialEndDate: true,
                  billingSubscription: { select: { tier: true, status: true } },
                },
              },
            },
          });
          if (dbUser) {
            token.organizationId = dbUser.organizationId;
            token.organizationName = dbUser.organization?.name || "";
            token.subscriptionStatus = dbUser.organization?.subscriptionStatus || "trial";
            token.trialEndDate = dbUser.organization?.trialEndDate
              ? dbUser.organization.trialEndDate.toISOString()
              : null;
            token.billingTier = dbUser.organization?.billingSubscription?.tier || "free";
            token.billingStatus = dbUser.organization?.billingSubscription?.status ?? null;
          }
        } catch (error) {
          console.error("JWT callback: refreshOrg failed", error);
        }
      }
      // Refresh billing fields on session update (e.g. after upgrade/downgrade)
      if (trigger === "update" && updateSession?.refreshBilling === true) {
        try {
          const org = await prisma.organization.findUnique({
            where: { id: token.organizationId },
            select: {
              subscriptionStatus: true,
              trialEndDate: true,
              billingSubscription: { select: { tier: true, status: true } },
            },
          });
          token.subscriptionStatus = org?.subscriptionStatus || "trial";
          token.trialEndDate = org?.trialEndDate ? org.trialEndDate.toISOString() : null;
          token.billingTier = org?.billingSubscription?.tier || "free";
          token.billingStatus = org?.billingSubscription?.status ?? null;
        } catch (error) {
          console.error("JWT callback: billing refresh failed", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.firstName = token.firstName;
      session.user.lastName = token.lastName;
      session.user.avatarUrl = token.avatarUrl;
      session.user.image = token.image ?? token.avatarUrl ?? null;
      session.user.role = token.role;
      session.user.organizationId = token.organizationId;
      session.user.organizationName = token.organizationName || "";
      session.user.subscriptionStatus = token.subscriptionStatus || "trial";
      session.user.trialEndDate = token.trialEndDate ?? null;
      session.user.billingTier = token.billingTier || "free";
      session.user.billingStatus = token.billingStatus ?? null;
      session.user.mfaPending = token.mfaPending ?? false;
      return session;
    },
  },
});

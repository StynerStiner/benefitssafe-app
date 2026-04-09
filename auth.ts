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

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 3600, // 1 hour — sessions expire after 60 minutes of inactivity
    updateAge: 900, // Refresh token every 15 minutes of active use
  },
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
        token.organizationId = user.organizationId;

        // Use the membership role for this org if it exists, otherwise fall back to user.role
        // This ensures multi-org users get the correct role per org
        let effectiveRole = user.role;
        try {
          const membership = await prisma.organizationMembership.findFirst({
            where: {
              userId: user.id as string,
              organizationId: user.organizationId,
              status: "active",
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

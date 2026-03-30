import { prisma } from "@/lib/db";
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
            },
          });

          if (!user || !user.passwordHash || !user.isActive) {
            return null;
          }

          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            return null;
          }

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
        } catch {
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
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.mfaPending = user.mfaPending ?? false;
      }
      // Allow clearing mfaPending via session update after MFA verification
      if (trigger === "update" && updateSession?.mfaPending === false) {
        token.mfaPending = false;
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
      session.user.mfaPending = token.mfaPending ?? false;
      return session;
    },
  },
});

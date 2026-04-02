# BenefitsSafe Multi-Tenant Migration -- Phase 1 Prompt for Claude Code VSCode

**Date:** April 2, 2026
**Purpose:** Sequential migration prompt -- paste into Claude Code to execute step by step
**Scope:** Data foundation + UI awareness. Zero breakage to existing queries.

---

## Context: Where We Are

BenefitsSafe is a Next.js 15.1.0 app at `/Users/stynerstiner/Downloads/Projects/benefits-safe-app` with the following stack:

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.1.0, App Router, TypeScript |
| ORM | Prisma v7 with PrismaPg adapter (no `url` in datasource block) |
| Database | AWS Aurora PostgreSQL 17.7, us-east-2 |
| Auth | NextAuth v5 (`import { auth } from "@/auth"`, JWT sessions) |
| DB Client | `import { prisma } from "@/lib/db"` |
| Generated Types | `@/lib/generated/prisma/client` |
| UI | React 19+, Tailwind v4, shadcn/ui (WowDash template) |

The codebase currently has **zero TypeScript errors** and all 7 major feature areas are working:

- Virtual cards end-to-end (Stripe Issuing, JIT funding, ephemeral key card reveal)
- Beneficiary ID generation (`beneficiaryCode` field, format `BS-{orgSeq}-{benSeq}`)
- Multi-org data isolation (all 15+ API routes enforce `organizationId` in WHERE clauses)
- Calendar, messaging, notifications (CRUD complete, polling, expense notification triggers)
- Role-based views (middleware `canAccessRoute()` enforcement across all 5 portals)
- Beneficiary dashboard (fetches own data, no 403s)
- Vendor dashboard (real vendor profile data)

**Current model is 1:1**: one User belongs to one Organization. `user.organizationId` is a direct foreign key. Email is globally unique.

**We are migrating to multi-tenant**: one User can belong to many Organizations through a membership table, with an active org context per session.

---

## CRITICAL RULES

1. **DO NOT break existing functionality.** Everything listed above must keep working after each step.
2. **DO NOT delete the existing `organizationId` on User yet.** We are adding the new system alongside the old one first, then migrating queries in a later phase.
3. **Run `npx prisma generate` after every schema change.**
4. **Run `npx tsc --noEmit` after every code change to verify zero TypeScript errors.**
5. **Commit after each numbered step below with the message format:** `feat(multi-tenant): Step N - description`

### Codebase-Specific Patterns (DO NOT deviate)

- **Auth:** `import { auth } from "@/auth"` then `const session = await auth()` -- this is NextAuth v5, NOT v4. Do NOT use `getServerSession(authOptions)`.
- **Prisma:** `import { prisma } from "@/lib/db"` -- do NOT use `import prisma from "@/lib/prisma"`.
- **Session shape:** `session.user.id`, `session.user.organizationId`, `session.user.role` (type `UserRole` from `@/lib/generated/prisma/client`).
- **Prisma commands that touch the database** require the `--url` flag because the datasource block has no `url` field: `npx prisma db push --url "$DATABASE_URL"`.
- **API route pattern:** NextAuth v5 App Router style -- `export async function GET(request: Request)` with `const session = await auth()`.
- **No emojis in code.** Use Lucide icons instead.
- **No new Tailwind classes or template style changes.** WowDash template styling is immutable.

---

## Step 1: Add the OrganizationMembership Model to Prisma Schema

Open `prisma/schema.prisma`. Add this model at the end of the file, before the closing comment or after the last model:

```prisma
// ============================================
// MULTI-TENANT MEMBERSHIPS
// ============================================

model OrganizationMembership {
  id               String   @id @default(cuid())
  userId           String
  organizationId   String
  role             String   @default("member") // matches UserRole values: nonprofit_admin, beneficiary, vendor, cpa, auditor, attorney, platform_admin, member, etc.
  status           String   @default("active") // active, suspended, pending, revoked
  invitedBy        String?
  joinedAt         DateTime @default(now())
  isDefaultOrg     Boolean  @default(false)
  lastAccessedAt   DateTime?
  orgSpecificTitle String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
  @@index([userId])
  @@index([organizationId])
  @@index([userId, status])
}
```

Then add the reverse relations. In the **User** model (around line 95-100), add alongside existing relations:

```prisma
memberships OrganizationMembership[]
```

In the **Organization** model (around line 38-45), add alongside existing relations:

```prisma
memberships OrganizationMembership[]
```

**DO NOT remove** the existing `organizationId` field on User or the existing `users User[]` relation on Organization. Both old and new must coexist.

Run:
```bash
npx prisma generate
npx tsc --noEmit
```

Verify zero errors before proceeding. Do NOT run `db push` yet -- that requires the database URL and we will handle it separately.

---

## Step 2: Create a Backfill Migration Script

Create file `prisma/backfill-memberships.ts`:

```typescript
// Backfill OrganizationMembership records from existing User.organizationId
// Run with: npx tsx prisma/backfill-memberships.ts
//
// This script uses the PrismaPg adapter since the datasource has no url field.
// Ensure DATABASE_URL is set in .env.local before running.

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add it to .env.local.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter }) as PrismaClient;

async function main() {
  const users = await prisma.user.findMany({
    where: { organizationId: { not: undefined } },
    select: { id: true, organizationId: true, role: true },
  });

  console.log(`Found ${users.length} users to backfill memberships for.`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.organizationId) continue;

    const existing = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.organizationId,
        },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role || "member",
        status: "active",
        isDefaultOrg: true,
        joinedAt: new Date(),
      },
    });
    created++;
  }

  console.log(`Backfill complete. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Run it after the schema has been pushed to the database:
```bash
npx tsx prisma/backfill-memberships.ts
```

Verify the output shows the correct count.

---

## Step 3: Create the Membership API Routes

### GET /api/memberships -- List current user's org memberships

Create `app/api/memberships/route.ts`:

```typescript
// GET /api/memberships -- List current user's organization memberships (for org picker)

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.organizationMembership.findMany({
      where: {
        userId: session.user.id,
        status: "active",
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { lastAccessedAt: "desc" },
    });

    return NextResponse.json(memberships);
  } catch (error) {
    console.error("GET /api/memberships error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### POST /api/memberships/switch -- Switch active organization

Create `app/api/memberships/switch/route.ts`:

```typescript
// POST /api/memberships/switch -- Switch active organization
// Updates both the membership lastAccessedAt AND the legacy user.organizationId
// for backward compatibility with all existing org-scoped queries.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    // Verify user has an active membership in this org
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
        status: "active",
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "No active membership in this organization" },
        { status: 403 },
      );
    }

    // Update lastAccessedAt on the membership
    await prisma.organizationMembership.update({
      where: { id: membership.id },
      data: { lastAccessedAt: new Date() },
    });

    // Update user's current organizationId (keeps backward compatibility)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { organizationId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "switch_org",
        entityType: "organization",
        entityId: organizationId,
        newValue: { orgName: membership.organization.name, role: membership.role },
      },
    });

    return NextResponse.json({
      success: true,
      activeOrg: membership.organization,
      role: membership.role,
    });
  } catch (error) {
    console.error("POST /api/memberships/switch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

Run:
```bash
npx tsc --noEmit
```

---

## Step 4: Create the Invite-to-Org API Route

Create `app/api/memberships/invite/route.ts`:

```typescript
// POST /api/memberships/invite -- Invite a user to the current organization
// Only nonprofit_admin and platform_admin can invite.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { validateRecipientEmail } from "@/lib/email-security";
import { NextResponse } from "next/server";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Valid email is required"),
  role: z.string().min(1, "Role is required"),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, id: userId } = session.user;

    // Verify inviter is an admin in this org via membership
    const inviterMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        status: "active",
        role: { in: ["nonprofit_admin", "platform_admin"] },
      },
    });

    if (!inviterMembership) {
      return NextResponse.json(
        { error: "Only admins can invite users" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { email, role } = parsed.data;

    // Validate email
    const emailCheck = validateRecipientEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.reason || "Invalid email address" },
        { status: 400 },
      );
    }

    // Find existing user
    const targetUser = await prisma.user.findUnique({
      where: { email },
    });

    if (targetUser) {
      // Check if already a member
      const existingMembership = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: targetUser.id,
            organizationId,
          },
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: "User is already a member of this organization" },
          { status: 409 },
        );
      }

      // Create pending membership
      const membership = await prisma.organizationMembership.create({
        data: {
          userId: targetUser.id,
          organizationId,
          role,
          status: "pending",
          invitedBy: userId,
        },
      });

      // Notify the invited user
      await prisma.notification.create({
        data: {
          userId: targetUser.id,
          organizationId,
          type: "org_invitation",
          title: "Organization Invitation",
          message: `You have been invited to join an organization as ${role.replace(/_/g, " ")}.`,
          href: "/settings/organizations",
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId,
          organizationId,
          action: "invite_to_org",
          entityType: "membership",
          entityId: membership.id,
          newValue: { email, role, status: "pending" },
        },
      });

      return NextResponse.json({
        success: true,
        membership,
        userExists: true,
      }, { status: 201 });
    }

    // User does not exist yet
    return NextResponse.json(
      {
        error: "User not found. They need to create an account first, then you can invite them.",
      },
      { status: 404 },
    );
  } catch (error) {
    console.error("POST /api/memberships/invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

Run:
```bash
npx tsc --noEmit
```

---

## Step 5: Build the OrgPicker Component

Create `components/org-picker.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Check } from "lucide-react";

interface Membership {
  id: string;
  role: string;
  isDefaultOrg: boolean;
  organization: {
    id: string;
    name: string;
    logoUrl?: string | null;
  };
}

export default function OrgPicker() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/memberships")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMemberships(data);
          const defaultMembership = data.find((m: Membership) => m.isDefaultOrg);
          if (defaultMembership) {
            setActiveOrgId(defaultMembership.organization.id);
          } else if (data.length > 0) {
            setActiveOrgId(data[0].organization.id);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrgId || switching) return;

    const targetOrg = memberships.find((m) => m.organization.id === orgId);
    const confirmed = window.confirm(
      `Switch to "${targetOrg?.organization.name}"?\n\nAll actions will be performed under this organization.`,
    );

    if (!confirmed) return;

    setSwitching(true);
    try {
      const res = await fetch("/api/memberships/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });

      if (res.ok) {
        setActiveOrgId(orgId);
        setIsOpen(false);
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to switch org:", error);
    } finally {
      setSwitching(false);
    }
  };

  const activeOrg = memberships.find((m) => m.organization.id === activeOrgId);

  // Don't render until loaded; single org shows static display
  if (memberships.length === 0) return null;

  if (memberships.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
        <Building2 className="w-4 h-4 text-primary" />
        <span className="truncate">{activeOrg?.organization.name}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <Building2 className="w-4 h-4 text-primary shrink-0" />
        <span className="truncate text-neutral-700 dark:text-neutral-200">
          {activeOrg?.organization.name || "Select Organization"}
        </span>
        <ChevronDown className={`w-4 h-4 ml-auto shrink-0 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[240px] bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-50">
          <div className="p-2 border-b border-neutral-100 dark:border-neutral-800">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium px-2 uppercase tracking-wider">
              Switch Organization
            </p>
          </div>
          <div className="p-1 max-h-64 overflow-y-auto">
            {memberships.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSwitch(m.organization.id)}
                disabled={switching}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  m.organization.id === activeOrgId
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.organization.name}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 capitalize">
                      {m.role.replace(/_/g, " ")}
                    </p>
                  </div>
                  {m.organization.id === activeOrgId && (
                    <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

Then mount it in the sidebar. Open `components/app-sidebar.tsx` and:

1. Import: `import OrgPicker from "@/components/org-picker";`
2. Add `<OrgPicker />` inside the `<SidebarHeader>` block, below the logo component.

Run:
```bash
npx tsc --noEmit
```

---

## Step 6: Add Org Context to the Active Session Display

Find the header component (`components/layout/header.tsx`) and the profile dropdown (`components/shared/profile-dropdown.tsx`). Add a visible indicator showing the current organization name.

In the header or profile dropdown, fetch the session and display:

```tsx
<div className="px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-md">
  {session?.user?.organizationName || "Organization"}
</div>
```

If `organizationName` is not in the session, fetch it from `/api/memberships` or add it to the session JWT callback in `auth.ts`. The simplest approach is to add `organizationName` to the JWT callback where `organizationId` is already set:

In `auth.ts`, in the JWT callback where it reads the user from the database, also fetch the org name:

```typescript
const org = await prisma.organization.findUnique({
  where: { id: dbUser.organizationId },
  select: { name: true },
});
token.organizationName = org?.name;
```

And in the session callback:

```typescript
session.user.organizationName = token.organizationName as string;
```

Update the Session type declaration to include `organizationName: string`.

Run:
```bash
npx tsc --noEmit
```

---

## Step 7: Add Confirmation Dialogs for High-Risk Actions

Find the frontend components that trigger these actions and add org-name confirmation before executing:

### 7a. Expense Approval

Find the expense approval button component (likely in the expenses page). Before calling `PATCH /api/expenses/[id]/approve`, show:

```typescript
const confirmed = window.confirm(
  `Approve this $${amount} expense under "${orgName}"?`
);
if (!confirmed) return;
```

### 7b. Card Issuance

Find the card issuance button component (likely in grants or expenses detail pages). Before calling `POST /api/grants/[id]/issue-card`, show:

```typescript
const confirmed = window.confirm(
  `Issue virtual card under "${orgName}" for ${beneficiaryName}?`
);
if (!confirmed) return;
```

### 7c. User Invitation

The invite flow from Step 4 should show before calling `POST /api/memberships/invite`:

```typescript
const confirmed = window.confirm(
  `Invite ${email} to "${orgName}" as ${role.replace(/_/g, " ")}?`
);
if (!confirmed) return;
```

For each, the org name should come from the session context or the OrgPicker state, never hardcoded.

Run:
```bash
npx tsc --noEmit
```

---

## Step 8: Final Verification

Run the full check:

```bash
npx prisma generate
npx tsc --noEmit
```

### Verification Checklist

- [ ] `OrganizationMembership` model exists in schema with `@@unique([userId, organizationId])`
- [ ] User model has `memberships OrganizationMembership[]` relation
- [ ] Organization model has `memberships OrganizationMembership[]` relation
- [ ] Existing `organizationId` on User is untouched
- [ ] Existing `users User[]` on Organization is untouched
- [ ] Backfill script exists at `prisma/backfill-memberships.ts`
- [ ] `GET /api/memberships` returns current user's active memberships
- [ ] `POST /api/memberships/switch` switches active org and updates `user.organizationId` for backward compatibility
- [ ] `POST /api/memberships/invite` creates pending memberships for existing users with Zod validation
- [ ] OrgPicker component renders in sidebar header
- [ ] Org name is visible in the header/profile area
- [ ] High-risk actions (expense approval, card issuance, user invite) show org-name confirmation
- [ ] Zero TypeScript errors
- [ ] All existing functionality still works: cards, expenses, notifications, calendar, messaging, role enforcement
- [ ] No template styling was changed

---

## What This Does NOT Change (Saved for Phase 2-4)

| Deferred Item | Target Phase |
|---------------|-------------|
| API routes still use `user.organizationId` for WHERE clauses | Phase 3 -- switch to membership-based lookups |
| Auth session does not carry `activeOrgId` as a first-class token field | Phase 2 |
| Beneficiary profiles are not yet separated from User records | Phase 4 |
| URL structure does not include `/org/[orgId]/` prefix | Phase 2 |
| No org-specific color banding or theming | Phase 2 UX |
| Pending invites for users who do not exist yet | Phase 2 |

This phase establishes the **data foundation** and **UI awareness** without breaking a single existing query.

---

## Key File Reference

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | OrganizationMembership model added here |
| `prisma/backfill-memberships.ts` | One-time script to create memberships from existing users |
| `app/api/memberships/route.ts` | GET -- list user's org memberships |
| `app/api/memberships/switch/route.ts` | POST -- switch active org with backward compat |
| `app/api/memberships/invite/route.ts` | POST -- invite user to org |
| `components/org-picker.tsx` | Dropdown component for org switching |
| `components/app-sidebar.tsx` | Mount point for OrgPicker |
| `auth.ts` | Add organizationName to session JWT |
| `components/layout/header.tsx` | Display org context badge |
| `middleware.ts` | Role enforcement (already done, no changes needed) |

# CLAUDE.md — Benefits-Safe Grant Disbursement Platform
# =====================================================
# THIS FILE IS THE BRAIN OF THE PROJECT.
# Claude AI in VS Code MUST read this file before writing ANY code.
# If you are Claude, read this ENTIRE file before responding to any request.
# Do NOT skip sections. Do NOT guess. Follow these instructions exactly.

---

## CRITICAL: PROJECT FOLDERS

There are 5 folders in ~/Downloads/Projects/:

| Folder | Purpose | Edit? |
|--------|---------|-------|
| `benefits-safe-app` | **ACTIVE PROJECT** — the dashboard app (all 2026-04-17 work lands here; Vercel production points here) | YES — all edits go here |
| `wowdash-next-shadcn-typescript-main` | **ORIGINAL TEMPLATE** — untouched reference copy | **NEVER EDIT** — READ ONLY |
| `benefits-safe-app-main` | OLD app — being phased out | Do not edit |
| `benefits-safe-marketing` | Marketing website (port 3000) | Separate project |
| (empty folder) | Ignore | — |

### THE GOLDEN RULE:
- **READ** from `wowdash-next-shadcn-typescript-main` to understand original design
- **EDIT** only in `benefits-safe-app`
- **NEVER** write to, edit, or modify `wowdash-next-shadcn-typescript-main`

---

## ABSOLUTE DESIGN RULE — READ THIS FIRST

**DO NOT CHANGE ANY FONTS, FONT SIZES, FONT WEIGHTS, COLORS, SPACING, PADDING, MARGINS, OR CSS CLASSES FROM THE ORIGINAL TEMPLATE.**

The WowDash template has perfect, accessible, readable design. Every time you change a font size or weight, you break accessibility for people with disabilities.

### When editing ANY file:
1. READ the original from `wowdash-next-shadcn-typescript-main/` first
2. COPY it as your base
3. ONLY change: hardcoded data → fetched data, text labels → BenefitsSafe labels
4. DIFF after editing — if any `className` differs from the original, REVERT IT

### THE ONLY ACCEPTABLE CHANGES:
- Add `"use client"` at line 1
- Add `import { useState, useEffect } from "react"`
- Add `import { useSession } from "next-auth/react"`
- Add useState + useEffect + fetch calls inside the component
- Replace hardcoded data VARIABLES with fetched data
- Change text STRINGS (like "Revenue" → "Grants")
- Add props to component function signatures

### NEVER:
- Write inline styles
- Invent new Tailwind classes
- Import new fonts
- Change font-* classes
- Change text-sm/xs/base/lg/xl sizes
- Change bg-* color classes
- Change p-*/m-* spacing classes
- Change rounded-* classes
- Remove Image imports or change image sources
- Change grid-cols or col-span values
- Restructure JSX nesting

---

## PROJECT IDENTITY

- **Product Name**: BenefitsSafe
- **What It Does**: Helps nonprofits disburse restricted grant funds to vendors on behalf of beneficiaries who receive SSI, SSDI, Medicaid, and Medi-Cal — without those beneficiaries losing their government benefits.
- **Core Value**: "Help nonprofits disburse restricted funds without turning them into benefits problems."
- **Scale**: 1.9M nonprofits, unlimited beneficiaries, unlimited vendors. This is a bank, not a tool.
- **This is a FINTECH COMPLIANCE product.** Every line of code matters.

---

## THE THREE PARTIES IN EVERY GRANT

1. **Grant Issuer** — The foundation or funder who awarded the money
2. **Grant Receiver** — The nonprofit holding the money (the org using our platform)
3. **Intended Beneficiary** — The person the grant is for (e.g., a writer on SSI)

These are THREE SEPARATE database entities. Never merge them.

---

## TECH STACK — ACTUAL (as built)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | **15.1.0** (downgraded from 16 for apexcharts compatibility) |
| UI Library | React | 19+ |
| Language | TypeScript | 5.8+ |
| CSS | Tailwind CSS | v4 |
| Components | shadcn/ui | Latest |
| Auth | NextAuth v5 | Credentials + Google + Microsoft Entra ID (common-tenant) |
| Database | PostgreSQL | AWS Aurora (us-east-2) |
| ORM | Prisma | Latest |
| Cards | Stripe Issuing | Latest |
| Validation | Zod | Latest |
| Charts | ApexCharts | 3.44.0 (pinned) + react-apexcharts 1.4.1 (pinned) |
| Icons | Lucide React | Latest |
| AI | Anthropic SDK | Claude Sonnet for Compliance Assistant |
| Template | WowDash Next.js shadcn | All 60 pages mapped to BenefitsSafe features |

### BANNED: Bootstrap, jQuery, Firebase, MongoDB, Express.js, Pages Router, `any` type

---

## 5 PORTALS — 1 TEMPLATE

The sidebar changes based on the logged-in user's role. Every page uses an EXISTING WowDash template page. We do NOT create new pages.

### PORTAL 1 — NONPROFIT ADMIN (the main product)

| Template Route | BenefitsSafe Page | Status |
|---|---|---|
| `/(homes)/finance` | Admin Dashboard | Wired |
| `/(homes)/project-management` | Grants | Wired |
| `/(homes)/ecommerce` | Expenses | Wired |
| `/(homes)/crm` | Beneficiaries | Wired |
| `/users-list` | Vendors | Wired |
| `/(homes)/nft` | Virtual Cards | Wired |
| `/(homes)/sass` | Subscriptions | Wired |
| `/(homes)/analytics` | Reports & Analytics | Wired |
| `/(homes)/call-center` | Audit Trail | Wired |
| `/(homes)/cryptocurrency` | Ledger & Transactions | Wired |
| `/(homes)/booking` | Disbursement Policies | Wired |
| `/(homes)/inventory` | Documents & Files | Wired |
| `/users-grid` | Team Management | Wired |
| `/chat` | Messages | Wired |
| `/email` | Notifications Inbox | Pending |
| `/calendar` | Calendar | Pending |
| `/company` | Organization Settings | Pending |
| `/notification-alert` | Alert Preferences | Pending |
| `/view-profile` | Profile | Done |
| `/(homes)/help` | Support / Help Center | Pending |
| `/(homes)/lms` | Onboarding & Training | Pending |

### PORTAL 2 — BENEFICIARY

| Template Route | BenefitsSafe Page | Status |
|---|---|---|
| `/(homes)/dashboard` | My Dashboard | Wired |
| `/(homes)/project-management` | My Grants | Shared with admin (role-filtered) |
| `/(homes)/ecommerce` | My Expenses | Shared |
| `/(homes)/sass` | My Subscriptions | Shared |
| `/(homes)/nft` | My Cards | Shared |
| `/chat` | Messages | Shared |
| `/view-profile` | My Profile | Done |

### PORTAL 3 — VENDOR

| Template Route | BenefitsSafe Page | Status |
|---|---|---|
| `/(homes)/investment` | Vendor Dashboard | Wired |
| `/(homes)/sales` | Invoices & Payments | Wired |
| `/view-profile` | Vendor Profile | Shared |

### PORTAL 4 — CPA / AUDITOR / ATTORNEY / COMPLIANCE

| Template Route | BenefitsSafe Page | Status |
|---|---|---|
| `/(homes)/analytics` | Reports | Shared with admin |
| `/(homes)/call-center` | Audit Trail | Shared |
| `/(homes)/podcast` | Compliance Dashboard | Pending |
| `/(homes)/cryptocurrency` | Ledger Review | Shared |
| `/(homes)/inventory` | Document Review | Shared |

### PORTAL 5 — PLATFORM ADMIN (BenefitsSafe internal)

| Template Route | BenefitsSafe Page | Status |
|---|---|---|
| `/(homes)/medical` | Platform Dashboard | In Progress |
| `/users-list` | All Users Lookup | Shared |
| `/(homes)/crm` | All Organizations | Pending (role-conditional) |
| `/(homes)/help` | Support Dashboard | Pending |
| `/(homes)/analytics` | Platform Metrics | Shared |

### AUTH PAGES

| Template Route | BenefitsSafe Page |
|---|---|
| `/auth/login` | Login |
| `/auth/register` | Nonprofit Registration |
| `/auth/forgot-password` | Forgot Password |
| `/auth/create-password` | Accept Invite |

---

## SIDEBAR NAVIGATION

The sidebar is defined in `components/sidebar-data.ts` with a `getNavForRole(role)` function. It returns different nav items for each role. The sidebar component (`components/app-sidebar.tsx`) reads the session role and renders accordingly.

**DO NOT** add new nav items without updating both `sidebar-data.ts` and this document.

---

## USER ROLES (12 roles)

| Role | Default Route | Description |
|------|--------------|-------------|
| `nonprofit_admin` | `/finance` | Org owner. Full access |
| `nonprofit_staff` | `/finance` | Org employee. View + submit |
| `beneficiary` | `/dashboard` | Benefit recipient. Own data only |
| `cpa` | `/analytics` | Accountant. Reports + audit |
| `auditor` | `/call-center` | External auditor. Read-only |
| `attorney` | `/podcast` | Legal advisor. Compliance |
| `grant_officer` | `/project-management` | Grant issuer rep |
| `vendor` | `/investment` | External vendor. Own profile |
| `platform_admin` | `/medical` | BenefitsSafe staff. God mode |
| `compliance_officer` | `/podcast` | Compliance specialist |
| `support_agent` | `/help` | Support staff |
| `billing_admin` | `/settings/billing` | Billing management |

---

## DATABASE SCHEMA

22 Prisma models. Full schema in `prisma/schema.prisma`. Key models:

- **Organization** — tenant (1.9M nonprofits)
- **User** — 12 roles, beneficiary-specific fields (DOB, SSN last4, benefit programs)
- **Grant** — 3-party model, totalAmount/spentAmount/remainingAmount (Decimal 12,2)
- **BudgetCategory** — per-grant budget lines
- **ExpenseRequest** — with compliance riskClassification
- **Vendor** — 3 types, 7 statuses
- **Subscription** — vendor subscriptions managed on behalf of beneficiaries
- **VirtualCard** — Stripe Issuing cards
- **Transaction** — card transactions
- **LedgerEntry** — IMMUTABLE restricted fund ledger
- **Approval** — expense approval records
- **AuditLog** — IMMUTABLE activity log
- **Conversation/Message** — internal messaging
- **Notification** — system alerts
- **Document** — file attachments
- **DisbursementPolicy** — org-level payment rules
- **InviteToken** — user onboarding

### Database Rules:
1. LedgerEntry and AuditLog are IMMUTABLE — never update or delete
2. All money fields use Decimal(12,2) — never Float
3. Every write creates an AuditLog entry
4. All queries scoped by organizationId (except platform_admin)
5. Soft deletes only (archivedAt field)

---

## COMPLIANCE ENGINE

Located in `utils/compliance-rules/`. Three files:

- `federal-ssi.ts` — Federal SSI rules (BLOCKED/LIKELY_RISKY/NEEDS_REVIEW/LIKELY_SAFE)
- `california.ts` — CA Medi-Cal/CalFresh/IHSS overlay
- `index.ts` — Entry point, applies federal first then state, most restrictive wins

Every expense runs through `classifyExpense()` before saving. Result stored in `ExpenseRequest.riskClassification`.

### Risk Levels:
| Level | Color | Action |
|-------|-------|--------|
| LIKELY_SAFE | Green | Proceeds to approval |
| NEEDS_REVIEW | Yellow | Flagged for manual review |
| LIKELY_RISKY | Orange | Warning, requires attorney review |
| BLOCKED | Red | Auto-blocked, cannot proceed |

---

## COMPLIANCE ASSISTANT (AI Chat Widget)

Floating widget on every dashboard page. Uses Claude Sonnet with web search targeting SSA.gov, IRS.gov, CMS.gov. Located in `components/ai/compliance-chat.tsx`. Mounted globally via `app/client-root.tsx`. Restricted to authorized roles.

---

## API ROUTES

All in `app/api/`. Key routes:

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/grants` | GET, POST | List/create grants |
| `/api/grants/[id]` | GET, PATCH | Grant detail/update |
| `/api/expenses` | GET, POST | List/create expenses |
| `/api/expenses/[id]/approve` | POST | Approve expense |
| `/api/expenses/[id]/reject` | POST | Reject expense |
| `/api/beneficiaries` | GET, POST | List/create beneficiaries |
| `/api/vendors` | GET, POST | List/create vendors |
| `/api/vendors/[id]/approve` | POST | Approve vendor |
| `/api/subscriptions` | GET | List subscriptions |
| `/api/virtual-cards` | GET, POST | List/create cards |
| `/api/audit-logs` | GET | Audit trail |
| `/api/ledger` | GET | Ledger entries + transactions |
| `/api/documents` | GET | Document list |
| `/api/policies` | GET, PATCH | Disbursement policies |
| `/api/messages/conversations` | GET, POST | Messaging |
| `/api/platform/stats` | GET | Platform admin stats |
| `/api/ai/chat` | POST | Compliance assistant |
| `/api/vendor/profile` | GET | Vendor's own profile |

---

## VALIDATION SCHEMAS

In `lib/zod.ts` and `lib/validations/`:
- `beneficiary.ts` — create/update beneficiary with benefit programs
- `expense.ts` — create/approve/reject expense
- `grant.ts` — create/update grant with benefit flags
- `vendor.ts` — create/update vendor (3 types)

---

## KEY WORKFLOWS

### Grant Lifecycle: DRAFT → ACTIVE → COMPLETED (or SUSPENDED → ARCHIVED)
### Expense: Submit → Compliance classify → Approval queue → Approved/Rejected → Card issued
### Vendor: PENDING → APPROVED → ACTIVE (or REJECTED/BLOCKED)
### Invite: Admin creates → Token sent → User sets password → Auto-login

---

## ENVIRONMENT VARIABLES

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
```

---

## DEVELOPMENT SERVERS

| Project | Port | Command |
|---------|------|---------|
| benefits-safe-app | 3002 | `npm run dev -- -p 3002` |
| benefits-safe-app-main (old) | 3001 | `npm run dev -- -p 3001` |
| benefits-safe-marketing | 3000 | `npm run dev -- -p 3000` |

---

## CODING STANDARDS

### TypeScript:
- Strict mode always on
- No `any` types (use `unknown` and type guards instead)
- All function parameters and return types must be typed
- Use Zod schemas for runtime validation at API boundaries
- Use Prisma-generated types for database models

### Components:
- All components are functional (no class components)
- Use Server Components by default; add `'use client'` only when needed
- Props interfaces defined above the component
- Destructure props in the function signature
- Use `cn()` utility for conditional classes (from shadcn)

### File Naming:
- Components: `kebab-case.tsx` (e.g., `grant-form.tsx`)
- Types: `kebab-case.ts` (e.g., `grant.ts`)
- Utilities: `kebab-case.ts` (e.g., `compliance-rules.ts`)
- API routes: `route.ts` inside folder structure

### Error Handling:
- Every API route wrapped in try/catch
- Every async component wrapped in error boundary
- User-facing errors are clear and actionable
- Technical errors logged to Sentry, not shown to users
- Never expose stack traces, SQL errors, or internal details

### Security:
- All inputs validated with Zod before processing
- All database queries parameterized (Prisma handles this)
- CSRF protection on all mutation endpoints
- Rate limiting on auth and financial endpoints
- Sensitive data encrypted at rest
- No secrets in client-side code (use environment variables)
- Environment variables: NEXT_PUBLIC_ prefix ONLY for non-sensitive values

---

## WHAT NOT TO DO

1. Do NOT store financial amounts as Float or Number. Use Decimal/String.
2. Do NOT hard-delete any financial record. Soft-delete only.
3. Do NOT return data from other organizations in API responses.
4. Do NOT trust client-side role checks alone. Always verify server-side.
5. Do NOT log sensitive data (card numbers, bank details, SSN).
6. Do NOT skip the compliance disclaimer on risk classification screens.
7. Do NOT create separate codebases for each dashboard. One app, role-based views.
8. Do NOT use Bootstrap, jQuery, or Firebase. See banned technologies list.
9. Do NOT modify shadcn/ui component files directly. Create wrapper components.
10. Do NOT store passwords, card numbers, or bank credentials. Use Stripe/Plaid/Auth provider.
11. Do NOT skip audit logging. Every data mutation gets an audit log entry.
12. Do NOT use `any` type. Use `unknown` with type guards.
13. Do NOT change template fonts, font sizes, colors, spacing, or CSS classes.
14. Do NOT create new pages — map features to existing template routes.

---

## COMPLETE DOCUMENT LIBRARY

These documents contain the full business logic, legal framework, market analysis, and technical specifications:

| # | Document | What It Contains |
|---|----------|-----------------|
| 1 | **PRD** (prd-benefits-safe-grant-platform.docx) | 22 sections: legal framework for SSI/Medi-Cal safe disbursement, three-party grant model, user roles & permissions, full data model, core features, grant workspace & budget management, virtual card operations, vendor management & approval workflow, subscription payment flow, compliance engine, receipt management, reporting/CPA/tax compliance, notifications, integrations, security standards, UI design, pricing model, development roadmap, appendices with sample policies and SSI-safe expense categories. |
| 2 | **PRD Addendum** (prd-addendum.docx) | Part 1: Legal entity & liability shield, terms of service & legal agreements, data privacy (CCPA/CPRA/HIPAA/ADA), security hardening (SOC 2, MFA, pen testing, WAF, incident response), WCAG 2.1 AA accessibility, multi-state compliance roadmap, disaster recovery, customer support, fraud prevention, API & white-label opportunity, onboarding & training, internal analytics. Part 2: Revenue model with 5-year projections, unit economics, refined 4-tier pricing, additional revenue streams, path to profitability, GTM strategy, competitive moat. Part 3: Pre-launch checklist. |
| 3 | **Market Analysis** (market-projections.docx) | Verified data: 7.5M SSI recipients, 14M ABLE-eligible, 1.9M US nonprofits, 214K ABLE accounts opened (1.5% adoption). Three financial scenarios (Conservative: $7.4M ARR Year 5, Base: $21M ARR Year 5, Aggressive: $67.5M ARR Year 5). |
| 4 | **Technical Blueprint** (technical-blueprint.docx) | Build vs buy decisions, full tech stack with rationale, modular monolith architecture, 6-month MVP timeline, Year 1 cost breakdown, hiring guide, success/failure factors. |
| 5 | **Template Guide** (template-guide.docx) | Dashboard inventory, template recommendations, color palette, developer setup instructions. |
| 6 | **Project Handoff** (project-handoff.docx) | Complete summary of all decisions for continuing in new conversations. |

---

## Legal Doc Sync Automation

The three public legal documents have a single source of truth in this repo at `docs/legal/PRIVACY-POLICY.md`, `TERMS-OF-SERVICE.md`, and `DATA-PROCESSING-AGREEMENT.md`. A GitHub Action keeps the public copies at `benefitssafe.com/privacy`, `/terms`, and `/dpa` in sync automatically — **never edit the marketing repo's `content/legal/*.md` files directly.**

- **Workflow:** [.github/workflows/sync-legal-to-marketing.yml](.github/workflows/sync-legal-to-marketing.yml) — triggers on push to `main` touching `docs/legal/**.md`, opens a PR in `benefitssafe-marketing` for human review (not auto-merge).
- **Required secret:** `MARKETING_REPO_PAT` (classic PAT, `repo` scope) in this repo's **Settings → Secrets and variables → Actions**. Setup steps: [docs/legal/SYNC-SETUP.md](docs/legal/SYNC-SETUP.md).
- **Drift check anytime:** `./scripts/verify-legal-sync.sh` — clones the marketing repo and SHA-256-compares all three synced files. Exit 0 = in sync; 1 = drift.
- **Dormant until PAT is added.** The workflow is active in the repo; it simply fails at the checkout-marketing-repo step until the secret exists.

To update a legal doc: edit in this repo → commit → push → review the PR that opens in `benefitssafe-marketing` → merge → Vercel auto-deploys. Done.

---

## DDIA Audit — Spec-Drift Notes

The original DDIA Chapter 12 audit spec referenced file paths and field names that differ from where the fixes actually landed. Future sessions: use the **Actual** column, not the spec.

| Defect | Spec assumed | Actual in code |
|--------|--------------|----------------|
| H1 (Stripe Connect callback URL) | `app/api/auth/stripe-onboarding/route.ts` | `app/api/org/stripe-onboarding/route.ts` |
| H2 (account.updated webhook handler) | `app/api/webhooks/stripe-billing/route.ts` | `app/api/webhooks/stripe/route.ts` (the Issuing/Connect webhook, not the Billing webhook) |
| H2 (persisted field) | `Organization.stripeAccountStatus` | `Organization.bankConnectedAt` + `Organization.lastStripeAccountEventAt` (the `charges_enabled` / `payouts_enabled` flags are captured in `AuditLog.newValue`, not as a dedicated column) |

Status as of 2026-04-21: all six tail-end defects (C2, H1, H2, H4, H5, P1) verified CLOSED — see `docs/STATUS-DDIA-AUDIT.md` for the full evidence trail.

---

## Security Standard (app repo)

This repo is a production fintech platform handling PII, real money, and authenticated sessions. The security bar is higher than the marketing site.

### Zero-tolerance scope

Known vulnerabilities in production-critical dependencies must be remediated or documented. Production-critical = anything touching:

- Authentication (NextAuth, session handling, MFA)
- Payments (Stripe SDK, webhook handlers, Connect/Issuing/Treasury)
- Database access (Prisma, Aurora connections, query scoping)
- Encryption (bcryptjs, crypto libs, session fingerprints)
- Multi-tenant query scoping (every query touching `organizationId`)
- API routes under `app/api/**`
- Middleware (`middleware.ts`)
- Cron jobs / workers (`@upstash/qstash`)

### Exception path

Vulnerabilities that are genuinely not reachable in production (dev-only tooling, unused code paths, attack vectors requiring preconditions we don't meet) may be accepted if documented in `docs/security-exceptions.md` with:

- **Attack surface analysis** — where the vulnerable code runs, who can reach it
- **Exploitability assessment** — what an attacker needs, what our code actually does
- **Mitigation in place** — WAF, rate limiting, feature flags, config that reduces reachability
- **Remediation path** — what triggers removal of the exception (upstream patch, major bump, etc.)

"Not currently exploitable" is not sufficient on its own. Document the reachability analysis and the mitigations.

### Baseline requirements

- `.npmrc` with `ignore-scripts=true`, `save-exact=true`, `legacy-peer-deps=true`
- `package-lock.json` committed
- `engines.node` pinned in package.json
- `.nvmrc` present
- Every dependency change requires: `npm audit` checked, `npm run build` verified, vitest suite run
- Post-deploy smoke test on `/api/health` (HTTP 200) + manual verification of auth + dashboard + upload paths
- Pre-install: web-search for recent supply-chain advisories on the specific package(s) being installed (CISA-recommended practice post-Axios attack March 2026)

### Touch-restricted paths (approval required before editing during security work)

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `app/api/webhooks/stripe/**`
- `auth.ts` / `auth.config.ts` (NextAuth setup)
- `.env`, `.env.local`

---

## Threat Modeling Checklist

Every PDR's **Documented Failure Modes** section must walk these 13 letters with one line each. Mark irrelevant letters `N/A: <reason>` — explicit N/A proves the category was considered, not overlooked.

### STRIDE (security)

- **S** — Spoofing
- **T** — Tampering
- **R** — Repudiation
- **I** — Information disclosure
- **D** — Denial of service
- **E** — Elevation of privilege

### LINDDUN (privacy — critical for SSI / Medi-Cal / CalFresh PII)

- **L** — Linkability
- **I** — Identifiability
- **N** — Non-repudiation
- **D** — Detectability
- **D** — Disclosure of information
- **U** — Unawareness
- **N** — Non-compliance

Reference: Tarandach & Coles, *Threat Modeling* (O'Reilly 2020), Chapter 3 (STRIDE-per-Element) and Specialized Methodologies (LINDDUN).

### Threat Model Every Story (CTM)

Every PDR that makes a code, schema, config, or infrastructure change walks this contract (the same contract lives in [docs/CTM-BASELINE.md §0](docs/CTM-BASELINE.md) — intentional redundancy so a PDR author opening either document cold gets the rules):

1. **Grep [docs/CTM-BASELINE.md](docs/CTM-BASELINE.md) §3 Crown Jewels for scope match.** If the PDR touches any Crown Jewel's files/tables/routes, the PDR's Documented Failure Modes section must reference the Crown Jewels entry by ID (e.g. `CJ-8`) and explain how the change affects that asset's confidentiality / integrity / availability.
2. **Walk §4 Trust Boundaries.** If the PDR crosses any boundary (e.g. `TB-6` org ↔ org, `TB-2` app ↔ Stripe), reference the entry by ID and explain what enforcement keeps the crossing intended.
3. **Append to [docs/CTM-BASELINE.md](docs/CTM-BASELINE.md) in the same merge** if the PDR introduces a new external service, new DB, new role, new trust boundary, or a new Crown Jewel. No "we'll update the doc later" — same merge, same commit body.
4. **Add discovered gaps to §6 Open Questions.** A-CTM's `potential-tm-update` pattern: unknowns surfaced during a PDR become logged questions in §6, never silent assumptions. Future PDRs pick them up.
5. **Record remediation in [DEPENDENCY_AUDIT.md](DEPENDENCY_AUDIT.md)** when a PDR fixes a vuln or misconfig against a Crown Jewel or boundary.
   - *When the row needs to reference the merge SHA, split into two commits per the SHA-paradox pattern (audit-row commit follows code-fix commit, references its SHA, push both together).* Commit 1 ships the code fix + audit doc + OQ additions with **no** `DEPENDENCY_AUDIT.md` row; capture its SHA from `git log`; commit 2 appends the `DEPENDENCY_AUDIT.md` row referencing commit 1's SHA (subject: `audit-row(security): record <PDR-name> in DEPENDENCY_AUDIT.md`); push both commits in one push; one `vercel --prod` covers both. Avoids the amend paradox where a commit that names its own hash can never stabilize — first observed on commit `d3682fd` / `5bdb086` (LINDDUN-code audit, 2026-04-23).

Reference: Tarandach & Coles, *Threat Modeling* (O'Reilly 2020), Chapter 5 — The Autodesk Continuous Threat Modeling Methodology.

---

## REMEMBER

This platform protects vulnerable people's government benefits. A sloppy expense classification could cause someone to lose their SSI or Medi-Cal. A data breach could expose disability status. A compliance error could cost a nonprofit its 501(c)(3) status.

Code like it matters. Because it does.

**And NEVER change the template's fonts or styling. Ever.**

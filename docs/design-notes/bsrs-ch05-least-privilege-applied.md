# BSRS Chapter 5 (Design for Least Privilege) Applied to BenefitsSafe

**Reference:** Adkins, Beyer, Blankinship, Lewandowski, Oprea, Stubblefield. *Building Secure and Reliable Systems* (O'Reilly, 2020). Chapter 5, by Oliver Barrett, Aaron Joyner, and Rory Ward.

**Scope:** Map every concept in BSRS Ch 5 to a specific location and behavior in the BenefitsSafe codebase. Identify what least-privilege discipline we actually have, where it's partial, and what's missing entirely. Produce a P1–P5 gap list scoped to a solo-founder context.

**Audit date:** 2026-04-18
**Codebase commit at audit time:** `b844bbd` (34 commits after the 2026-04-17 DDIA Ch 7 + cross-org isolation + Prisma middleware Phase 1 session)

**Important framing:** BSRS Ch 5 is written for an organization with a security team, SRE team, platform team, and customer-support staff — roles that can plausibly be different people with conflicting interests. BenefitsSafe has one developer/operator (Styner). Wherever BSRS recommends "get a second person to approve," that translates to one of three things in solo context:

1. Deferrable check (self-approval with audit trail, review during weekly retrospective)
2. Hard-gated check that requires a second platform_admin (so it becomes a hiring prerequisite)
3. External automation (e.g., a time-delay automated approval with cancel-window)

I'll note which applies per concept. Don't let the Google-scale framing make it sound like BenefitsSafe has failed where actually the pattern is being practiced at solo scale.

---

## 0. Stack baseline for authorization

- **Auth library:** NextAuth v5 (JWT sessions)
- **Identity model:** `User.role` enum across 5 values: `nonprofit_admin`, `beneficiary`, `cpa`, `vendor`, `platform_admin`
- **Multi-org model:** `OrganizationMembership` (from the Phase 1 migration in commit `195b50b`) — users can have multiple org memberships with per-org role; `User.organizationId` is "last active" and MUST NOT be used for authorization decisions on multi-org users
- **Session data available at auth time:** `session.user.id`, `session.user.role`, `session.user.organizationId`, `session.user.email`
- **Org context propagation:** `lib/org-context.ts` — `AsyncLocalStorage<OrgContext>` backed by `node:async_hooks`, shipped in commit `9428032`. Discriminated union: `{ kind: "session", organizationId, userId, role }` or `{ kind: "exempt", reason: ExemptReason, note? }`. Exempt reasons: `CRON | WEBHOOK_DERIVE | AUTH_FLOW | PLATFORM_ADMIN | PLATFORM_METRIC | STATS_ADMIN`
- **Runtime guard:** `lib/prisma-org-scoping.ts` — Prisma v7 `$extends` middleware in shadow mode (Phase 1). Logs `shadow_violation` / `telemetry` / `extension_error` without blocking any query. Designed to fail quiet in production, loud in development (Phase 2 not yet enabled)
- **Database-level invariants:** CHECK constraints on `Grant.totalAmount >= 0`, `Grant.spentAmount >= 0`, `Grant.remainingAmount >= 0 OR allowNegativeBalance = true` (commit `07c6611`). Partial unique indexes on VirtualCard(grantId, beneficiaryId) WHERE status='ACTIVE'.
- **Audit trail:** `AuditLog` model with required fields `userId: String` (NOT NULL, no FK — sentinels like `"system"` and `"system_webhook"` are allowed), `organizationId: String` (NOT NULL, no FK — `"SYSTEM"` sentinel for platform-level events), `action: String`, `entityType`, `entityId`, optional `oldValue`/`newValue` JSON

This matters because every section below answers: "given session/membership-based roles + the ALS org-context + shadow-mode Prisma middleware + CHECK constraints + AuditLog, what least-privilege discipline do we actually have?"

---

## 1. Concepts and Terminology

### Least privilege

**BSRS framing:** Users should have the minimum access needed to accomplish a task, for both humans and systems. Extends through every authn/authz layer. Rejects ambient authority (e.g., `root` login) and implicit tooling authority.

**Where it lives in BenefitsSafe — PARTIAL:**

- **Role-gated API routes:** every API route except authentication flow checks `session.user.role` and returns 403 on mismatch. Pattern confirmed in 40/40 HANDLER_HAS_ORG stratified sample (commit `8bb8d0a`). Sample sites:
  - `app/api/platform/stats/route.ts:16` — `platform_admin` only
  - `app/api/platform/grants/[id]/reset-negative-balance-flag/route.ts:23` — `platform_admin` only
  - `app/api/expenses/[id]/route.ts:24,77,192` — session-authenticated, org-scoped via `grant: { organizationId }` relation
- **Org-scoped queries:** 742 Prisma queries audited; 70 adversarially verified; **zero real cross-org leaks found**. This is least privilege at the data-access layer.
- **Tool-level least privilege:** Prisma middleware Phase 1 logs every query for classification. Phase 2 (dev-throw on mutations) will reject any mutation without an org context. Phase 3 (production enforce) is the "zero touch production" equivalent in the SRE sense.

**Gaps:**

- **No ambient-authority problem** in code (we don't have SSH root access to production; Vercel manages the runtime). ✓
- **But:** `postgres` master role in Aurora is used by the app runtime — equivalent of running as root in PostgreSQL. Covered in `docs/runbooks/aurora-credential-rotation.md` (commit `9cf3636`) as deferred-execution, triggered on first real nonprofit. **This is a real least-privilege gap that's only deferred, not resolved.** See P1 below.
- **No breakglass registry.** Tonight shipped one breakglass endpoint (`reset-negative-balance-flag`) but there's no inventory of breakglass paths, their criticality, or how they're monitored. See P2.

### Zero trust networking

**BSRS framing:** Network location grants no implicit trust. Access is based on user credentials + device credentials (BeyondCorp). Plugging into a conference-room port gives no more access than a random internet connection.

**Where it lives in BenefitsSafe — NOT APPLICABLE AT CURRENT SCALE:**

BenefitsSafe is a SaaS accessed over HTTPS from arbitrary internet locations. There is no internal corporate network to trust or distrust. Every request goes through the same auth layer regardless of source IP.

**Residual concerns:**

- **Direct Aurora access:** the credentials for Aurora are in Vercel environment variables. `DATABASE_URL` is the only way in, and the app runtime uses it. No VPN or bastion. This is fine at current scale (pre-revenue) but becomes a concern when:
  - Multiple engineers need Aurora access (hiring)
  - Breach detection needs to distinguish "operator ran a query" from "attacker ran a query"
- The existing Aurora rotation runbook at `docs/runbooks/aurora-credential-rotation.md` covers *rotation* but not *access attribution*. At scale, you'd want an audit proxy between the app and Aurora (e.g., RDS Proxy with IAM auth + CloudTrail).

**Translation to solo context:** Instead of BeyondCorp-style device attestation, the equivalent is: never share the Vercel env vars outside your Mac, keep the laptop MFA'd, and rotate on any lost device. Codified informally already. No action item.

### Zero Touch

**BSRS framing:** Remove direct human access to production roles. Humans have indirect access through tooling that makes predictable, controlled changes. ZTP (Zero Touch Production), ZTN (Zero Touch Networking) at Google.

**Where it lives in BenefitsSafe — PARTIAL:**

- **App deploys:** `vercel --prod` from the CLI. That's a direct human action, not a tooling-mediated one. Every deploy tonight happened this way.
- **Migration applies:** `npx prisma migrate deploy` run manually from the CLI. Direct human access.
- **Direct Aurora writes:** You wrote `orgCode` and `memberCode` backfills directly via psql tonight (earlier in session). That's full ambient authority on production data.
- **Cron:** Vercel cron-triggered with bearer token — indirect/tooling path. ✓
- **Stripe webhooks:** indirect, signature-verified. ✓

**Gap:** Three direct-access paths (CLI deploy, CLI migrate, psql). At solo scale, "zero touch" is an aspiration not a hard requirement; the equivalent is *logged touch* — every direct action leaves an AuditLog entry or a git commit explaining what changed. This is partially satisfied: every deploy corresponds to a commit. Every migration is a git-tracked file. Direct psql writes are NOT audited anywhere in the codebase.

See P3 (direct psql write audit).

---

## 2. Classifying Access Based on Risk

**BSRS framing:** Not all data/actions are equal. Classify by impact, security risk, criticality. Handle public data vs company data vs user data vs cryptographic secrets differently. Administrative APIs differently from service-specific read APIs. Your classification framework scales from two-three types to robust programmatic systems.

**Where it lives in BenefitsSafe — IMPLICIT, NOT FORMALIZED:**

BenefitsSafe operates with an *implicit* classification across roles, but has never written it down:

| Classification | Examples | Current controls |
|---|---|---|
| **Public** | Landing pages, marketing site, pricing | None needed, unauthenticated |
| **Org-internal, read** | Beneficiary list, grant status, vendor list | Session + role + org-scoped query |
| **Org-internal, write (non-money)** | Vendor invite, beneficiary create, grant document upload | Session + role + org-scoped + audit log |
| **Money-flow, read** | LedgerEntry, Transaction, Grant.remainingAmount | Session + role + org-scoped query (read-only) |
| **Money-flow, write** | ExpenseRequest.approve, VirtualCard.issue, fund transfer, Grant refill | Session + role + org-scoped + `$transaction` + Serializable isolation + retryOnSerializationFailure + CHECK constraints |
| **Platform admin (cross-org)** | Platform stats, internal-staff management, stuck-grants override | Session + `platform_admin` role + withOrgContext exempt-wrap + audit log with operator userId |
| **Cryptographic secrets** | Stripe webhook secret, NextAuth JWT secret, Aurora master credential | Vercel env vars (prod) + `.env.local` (dev) — no rotation cadence yet |
| **System runtime secrets** | Issued virtual card numbers, CVVs, PANs | Stripe Issuing Elements with ephemeral keys — never stored in our DB |

**Missing:** this table does not exist in the codebase. It's reconstructible from audit findings and code review, but not canonical.

**Impact of the gap:** two failure modes.
1. When you hire your first engineer, they need a fast orientation to "what data is sensitive" and "what level of scrutiny goes with each action." Absent a classification doc, you'll either teach it ad-hoc (high error rate) or they'll ship something without knowing (worse).
2. When SOC 2 Type II audit comes, the auditor will ask for this exact table. Producing it under audit pressure is worse than producing it ahead.

See P2.

---

## 3. Best Practices (BSRS Section 5.3)

### Small Functional APIs

**BSRS framing:** Avoid open-ended interactive interfaces. Design around small functional APIs. Each endpoint does one thing well. Administrative APIs (setup/teardown, maintenance, emergency) are especially sensitive — they must be small.

**Where it lives in BenefitsSafe — MOSTLY STRONG:**

BenefitsSafe's API is REST-shaped and per-route:
- `/api/grants` — collection operations
- `/api/grants/[id]` — single-grant operations (GET/PATCH/DELETE)
- `/api/expenses/[id]/approve` — single action, scoped to one expense
- `/api/expenses/[id]/reject` — single action
- `/api/expenses/[id]/issue-card` — single action
- `/api/virtual-cards/[id]/close` — single action
- `/api/webhooks/stripe` — Stripe-dispatched, per-event-type handlers inside
- `/api/platform/grants/[id]/reset-negative-balance-flag` — single action, platform-admin only

This is explicitly BSRS-style: one action per endpoint, body schema per endpoint. No `/api/admin/exec` meta-endpoint. No SQL-as-a-service. No arbitrary command runner. ✓

**Administrative API surface is small:**
- `/api/platform/internal-staff` — list + invite
- `/api/platform/orgs` — list
- `/api/platform/stats` — aggregate stats
- `/api/platform/switch-org` — membership switcher
- `/api/platform/grants/stuck-overspend` — list (shipped tonight)
- `/api/platform/grants/[id]/reset-negative-balance-flag` — single override (shipped tonight)

That's 6 platform-admin endpoints. Small, functional, single-purpose. Strong pattern.

**Gap:** there's no automated enforcement of "admin endpoints MUST be under /api/platform". A developer could add an admin-capable endpoint under `/api/grants/` without the `platform_admin` guard. Today this is caught by code review (i.e., you). At scale it needs a linter rule or a convention-based test. See P4.

### Breakglass

**BSRS framing:** Emergency access that bypasses your authorization system completely. Restricted access, specific locations (panic rooms), monitored, tested regularly.

**Where it lives in BenefitsSafe — EMERGING:**

- **Current breakglass paths identified:**
  1. `/api/platform/grants/[id]/reset-negative-balance-flag` — intentionally designed as breakglass tonight (commit `854a984`). Audit log, zod-validated reason, platform_admin only. Has a UI (commit `3d95348`).
  2. **Direct Aurora psql access** — implicit breakglass via `DATABASE_URL`. Used tonight for orgCode/memberCode backfills. NOT audited.
  3. **`.env.local` edits** — changing env vars is implicit breakglass. Not logged.
  4. **Vercel dashboard access** — implicit breakglass via Vercel web UI (can roll back deploys, change env vars, kill running functions). Not logged.
  5. **Disabling Prisma middleware** — documented in `docs/runbooks/prisma-middleware-phase-2-3-enablement.md` "Emergency: disable the extension entirely" section. Breakglass with a clear procedure. ✓

**Gap:** no central registry of breakglass paths. No policy on "when do we use each one," "who monitors usage," "how often do we test the breakglass works." At solo scale this translates to a monthly self-audit of breakglass events + a runbook listing them. See P2.

### Auditing

**BSRS framing:** Audit primarily serves to detect incorrect authorization usage. Audit log granularity depends on API granularity. Structured justification (bug/ticket/case ID) enables programmatic log verification. Central vs. team-level auditing for different audit purposes. Peers audit for best practices; centralized auditing for cross-team attack detection.

**Where it lives in BenefitsSafe — PARTIAL, with some concerning gaps:**

**What exists:**
- **AuditLog table** with NOT NULL `userId` + `organizationId` (enforced at DB level, commits `dab2f0f` / `54926d8`)
- **Every money-flow handler writes AuditLog** entries (approve, reject, issue-card, close, etc.) — confirmed in the 40/40 HANDLER_HAS_ORG stratified audit
- **Every platform-admin action writes AuditLog** — confirmed in the reset-negative-balance-flag handler (action=`reset_negative_balance_flag`, includes reason)
- **Webhooks write AuditLog** — confirmed in handleDisputeCreated, handleEarlyFraudWarning, handleChargeFraudDetected (after tonight's commit `54926d8` fixed the NOT NULL bug)

**What's missing:**
1. **No structured justification** for most actions. BSRS recommends: every audit event ties to a bug/ticket/case ID. BenefitsSafe's AuditLog has `entityId` (the thing acted on) but no "why this action" field except the newly-added `reason` on `reset_negative_balance_flag`. Nonprofit admins approving expenses don't record why — just that it was approved. This is fine for most actions (approval *is* the business record) but means compliance audits can't programmatically verify that platform interventions had justifications.
2. **No audit-log review cadence.** Nobody looks at AuditLog rows unless there's an incident. BSRS recommends weekly peer review of breakglass events. At solo scale this translates to a scheduled self-review (weekly, 10 minutes) with a saved SQL query.
3. **No immutability guarantee on AuditLog.** The `AuditLog` model allows `update` and `delete` operations via Prisma — so an attacker who compromises the app runtime can rewrite history. BSRS Ch 15 will hammer this harder; for now, this is a known gap.
4. **No retention policy.** AuditLog grows forever. At 1.9M orgs scale this becomes an operational problem (query performance, storage cost, GDPR deletion requests).

See P2 (auditing review cadence), P5 (immutability + retention).

### Testing and Least Privilege

**BSRS framing:** Two dimensions. (a) Testing *of* least privilege — ensure access is properly granted only to necessary resources. (b) Testing *with* least privilege — test infrastructure has only the access it needs.

**Where it lives in BenefitsSafe — NEARLY ZERO:**

- **No unit tests** for role-gated endpoints verifying the 403 paths
- **No integration tests** for the full auth-to-query chain
- **No test environment** separate from development (Aurora dev cluster is shared between local dev and any manual testing)
- **No ACL/policy test suite** to verify "nonprofit_admin from org A cannot read grants from org B" — only the 70-query adversarial audit + the shadow-mode middleware, both of which are observational, not preventative

**Why this is serious:** the cross-org isolation audit tonight verified **current** state. Any PR that breaks org-scoping is caught only by the shadow-mode middleware's logs (and only if the new handler is wrapped in withOrgContext, which most aren't). A regression would ship silently.

See P1 (isolation regression test suite) — this is probably the highest-leverage fix we could make.

### Diagnosing Access Denials

**BSRS framing:** Three outcomes when a denial happens. Blind 403 for low-privilege callers. Token-associated denial for mid-privilege callers (they can request access). Remediation hint for high-privilege callers (they can self-remediate). Balance support overload against info leakage.

**Where it lives in BenefitsSafe — GENERIC 403s:**

Every denial returns a generic `{ "error": "Forbidden" }` with 403. No token. No hint. No escalation path.

**Why this is fine at solo scale:** there's no support team to escalate to. If a nonprofit admin hits a 403, they email you directly. That's the "support channel" BSRS describes.

**Gap:** the 403 doesn't include *any* context, not even a correlation ID. When a nonprofit admin reports "I can't approve this expense," you have no way to correlate their error to a server log entry except by timestamp. See P4 (error-response correlation ID).

### Graceful Failure and Breakglass Mechanisms

**BSRS framing:** Large-scale incorrect denial (bad policy update) needs a circumvent path. Breakglass should be restricted to SRE team, from panic rooms, closely monitored, regularly tested.

**Where it lives in BenefitsSafe — implicit:**

- **"Bad policy update" at BenefitsSafe scale = a bad deploy.** Circumvent = `vercel rollback` or git revert + redeploy. Fast, tested implicitly every time you deploy.
- **Panic rooms** — no analog. Equivalent is "your laptop with the Vercel CLI."
- **Breakglass testing** — not done. You've never tested that the runbooks work. (The stuck-grants endpoint shipped tonight is tested by its first real use; we haven't simulated it.)

See P4 (quarterly breakglass test).

---

## 4. A Policy Framework for Authentication and Authorization Decisions

**BSRS framing:** Separate the concerns of authentication (who) and authorization (may they). Use a shared library for authorization decisions. Consider action, arguments, source, role metadata, server context. Centralize via IAM-style framework (Google internal IAM, GCP IAM, AWS IAM).

**Where it lives in BenefitsSafe — SCATTERED:**

Authorization logic is inlined per handler:

```ts
// app/api/platform/stats/route.ts:16
if (session.user.role !== "platform_admin") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

This pattern is copied across ~95 API routes. Each copy is a potential divergence point.

**What's good:**
- The pattern is uniform — every handler does the same check in the same place (top of handler, after auth, before business logic)
- Shadow-mode Prisma middleware (commit `9428032`) is a first-step authorization framework — it centralizes the "is this query org-scoped for this context" decision
- The `lib/permissions.ts` file exists (per the file listing in tonight's BSRS diagnostic) — suggests some centralization already, but I haven't audited its current state

**Gap:** no central policy file declaring "role X may perform action Y on resource type Z." Role logic is distributed across 95 handlers. Adding a new role (e.g., `auditor`, `read_only_cpa`) means touching every handler. A BSRS-style `@/lib/policy` framework with:

```ts
policy.check({ action: "approve_expense", resource: expense, actor: session.user })
```

...would centralize it. But this is a significant refactor — I'd classify it as P3 (medium-term) not P1.

See P3 (policy framework) and P4 (shared role-guard helper as an interim).

---

## 5. Advanced Controls

### Multi-Party Authorization (MPA)

**BSRS framing:** Two-person approval for risky actions. Prevents mistakes, discourages bad actors, increases attack cost, creates audit trail, provides customer comfort. Requires "someone can say no" culturally and technically.

**Where it lives in BenefitsSafe — NOT IMPLEMENTED:**

No action in BenefitsSafe requires two approvals. Not:
- Grant refill (admin refills their own grant with no second check)
- Expense approval (single nonprofit_admin approves)
- Vendor onboarding (single admin)
- Platform override (single platform_admin — tonight's endpoint)
- Org deletion (not implemented yet, but when it is, it should require MPA)

**At solo scale:** MPA is hard because there's only one platform_admin (you). Options:
1. **Automated delay + notify** — a risky action queues for 24 hours, sends an email, you can cancel. The delay itself is the "second party."
2. **External MPA** — email an approval request to a trusted person outside the company (cofounder, investor, board member). Requires social infrastructure you may not have.
3. **Defer to hire** — document MPA-required actions, implement when second platform_admin exists.

**What action would benefit most from MPA right now?** The tonight-shipped `reset-negative-balance-flag` endpoint. It lets a single platform_admin silently restore an overspend grant. If your admin account is compromised, an attacker could clear the flag on every grant in the system, effectively removing the CHECK constraint. MPA would require a second platform_admin to co-sign.

See P3 (MPA on critical platform-admin actions) — not urgent at solo scale but needs to be designed into the UI before hiring.

### Three-Factor Authorization (3FA)

**BSRS framing:** Approve the request on a hardened mobile device to mitigate compromise of the originating workstation. Distinct from 2FA/MFA (stronger auth of a user) — 3FA is stronger authorization of a specific request.

**Where it lives in BenefitsSafe — NOT APPLICABLE AT CURRENT SCALE:**

3FA requires:
1. A hardened mobile device
2. An infrastructure to push authorization prompts to that device
3. Users who have both a workstation and a trusted mobile

Solo founder + no enterprise MDM = none of these exist. This is correctly deferred to post-hire. Not a gap; a non-applicability.

### Business Justifications

**BSRS framing:** Tie access to a structured business justification (bug ID, case ID, ticket). Verify the justification programmatically. Prevents rubber-stamped access.

**Where it lives in BenefitsSafe — ONE SPOT:**

Tonight's `reset-negative-balance-flag` endpoint requires a `reason` string (≥10 chars, zod-validated). That's the only "structured justification" in the codebase. Every other action takes no justification.

**Where else could this apply?**
- Grant.status changes (CLOSED, SUSPENDED) — currently just happen
- Vendor rejection — no reason required
- Beneficiary deactivation — no reason
- Platform staff invite — no justification required

**Trade-off at solo scale:** adding required-reason to every action adds friction. The right scope is *high-risk actions only*: grant closure, vendor rejection, beneficiary deactivation, any breakglass.

See P2 (add justification field to high-risk actions).

### Temporary Access

**BSRS framing:** Grant access that expires. On-call rotations. Expiring group memberships. On-demand requests with scheduled revocation. Reduces ambient authority.

**Where it lives in BenefitsSafe — NOT IMPLEMENTED:**

All role grants are permanent. Once you make someone a `nonprofit_admin`, they are until explicitly demoted. Same for `platform_admin`.

**Solo-scale translation:**
- You as the only `platform_admin` — permanent. Nothing to rotate.
- `nonprofit_admin` per org — permanent, which is fine because the org owns that role.
- **But:** when CPA role is used for a single tax season, that access should expire. Currently it doesn't.

See P3 (expiring role grants, especially for CPA).

### Proxies

**BSRS framing:** Heavily monitored bastion between operators and sensitive systems. Restricts dangerous actions, rate-limits, advanced logging.

**Where it lives in BenefitsSafe — NEXT.JS IS THE PROXY:**

Every DB access goes through the Next.js app runtime. There's no direct "user logs in and gets a psql prompt." The app itself is the proxy between users and Aurora. ✓

**But:** you (operator) have direct psql access. No proxy in front. See P3 (audit proxy for direct Aurora access) — not urgent today but blocks the first hire.

---

## 6. Tradeoffs and Tensions

BSRS acknowledges:
1. **Security complexity** — need tooling to define/manage/test/debug policies
2. **Impact on collaboration** — broad source access good, broad data access bad
3. **Quality of security-impacting data** — bad data → bad decisions
4. **User productivity** — friction kills adoption
5. **Developer complexity** — third-party software integration is hard

**BenefitsSafe specifics:**
- (1) applies: shadow-mode middleware's telemetry IS the complexity-management tool. Phase 2/3 enablement runbook is the debug framework.
- (2) not applicable: solo dev, no one to share code with yet.
- (3) applies: `session.user.organizationId` is "last-active" for multi-org users — using it for authz on multi-org was identified as a real trap in the cross-org audit (commit `8bb8d0a`, stratified sample findings documented). This is exactly the "low-quality data leads to bad security decisions" pattern BSRS warns about.
- (4) applies: tonight's stuck-grants UI has a 10-char-min reason — that's friction. But it's justified friction for a high-risk action. Don't add it everywhere.
- (5) not applicable yet: BenefitsSafe is all first-party code.

---

## 7. Gap Inventory — P1–P5

Ordered by leverage × fix-cost. Solo-founder scope.

### P1 — Isolation regression test suite

**Problem:** Tonight's 40/40 cross-org audit verified current state but has no regression guard. A future PR that accidentally drops a `where: { organizationId }` clause would ship silently unless caught by the shadow-mode middleware (which only covers wrapped routes, which is 4 of 95 today).

**Fix:** One test file that exercises every org-scoped model with adversarial inputs. Structure: for each model, a test that creates data in org A, logs in as nonprofit_admin of org B, and asserts the API returns 404 or empty list (NOT data from org A). Target: `__tests__/isolation/cross-org.test.ts` with ~30 test cases matching the stratified audit.

**Scope:** 4–6 hours. Requires setting up Jest/Vitest (you have no test runner today — check package.json). Can start small: 10 highest-value models, expand over time.

**BSRS section:** "Testing of least privilege" (§5.3).

**Status:**
- Option A (classifier unit tests) — CLOSED in commit `907c657` (56 new tests in `__tests__/security/prisma-org-scoping.test.ts` covering every classification pathway + 4 documented blind-spot regression guards. CI vitest step is now blocking.)
- Option B (e2e cross-org HTTP tests with seeded second org) — OPEN, next PDR.

**Priority rationale:** highest-leverage because the audit is a point-in-time proof; tests are the living proof.

### P2 — Classification doc + audit review cadence + high-risk action justifications

**Problem:** BenefitsSafe has implicit access classifications, no formal doc. No audit review cadence. Most high-risk actions have no required justification.

**Fix:** Three-part doc + config change.

1. Create `docs/security/access-classification.md` — the table in §2 of this doc, formalized. ~200 lines.
2. Create `docs/runbooks/audit-log-review.md` — weekly self-review procedure. SQL queries to run. What to look for. Takes ~10 min/week. ~100 lines.
3. Add `reason` field (zod min 10 chars) to 3–4 highest-risk actions:
   - `Grant` status → CLOSED or SUSPENDED
   - `Vendor` rejection endpoint
   - `Beneficiary` deactivation endpoint
   - Any future platform-admin override (pattern established tonight)

**Scope:** 2–3 hours total. Docs + small code changes.

**BSRS section:** "Classifying Access Based on Risk" (§5.2), "Auditing" (§5.3).

**Status:**
- CLOSED in commit `69ea0d1` (access classification doc at `docs/security/access-classification.md`, audit-log review runbook at `docs/runbooks/audit-log-review.md`, zod reason-gates on grant terminal-status transitions + vendor reject, 13 new tests). Beneficiary deactivation reason-gate deferred to P2b (requires UI modal work).

### P2b — Beneficiary deactivation reason-gate + UI modal

**Problem:** `PATCH /api/beneficiaries/[id]` with `isActive=false` does not require a reason. Two UI toggle cards (`top-performer-card.tsx`, `todo-list-recent-card.tsx`) deactivate beneficiaries with a single click and no text input.

**Fix:** Shared "reason modal" UI component (reusable pattern that applies here, P3 when CPA access expires, and future high-risk UI paths). Server-side zod-gate on `PATCH /api/beneficiaries/[id]` when `body.isActive === false`. Both toggle cards call the modal before firing the PATCH.

**Scope:** 2–4 hrs. Modal component + 2 UI call-site updates + 1 route change + ~4 tests.

**BSRS section:** §5.3 Auditing (business justifications).

**Priority rationale:** split off from P2 to keep P2 tight and because the modal is reusable. The deactivation itself is org-internal (non-money) so urgency is lower than P1 and P3.

### P3 — Expiring role grants (CPA role, temporary platform access)

**Problem:** All role grants are permanent. CPA role used for seasonal work has no expiry. Temporary platform_admin access for future hires has no mechanism.

**Fix:**

1. Add `OrganizationMembership.expiresAt: DateTime?` column. Nullable; null means permanent.
2. Update role-check middleware: if `expiresAt !== null AND expiresAt < now`, treat role as expired. Return 403.
3. Add a weekly cron job that logs expiring-soon memberships.
4. Add a platform-admin UI to grant time-limited access (analogous to tonight's stuck-grants page).

**Scope:** 4–6 hours. Schema migration + middleware change + cron + UI.

**BSRS section:** "Temporary Access" (§5.5).

**Priority rationale:** not urgent today (pre-CPA-season), but designing it in before a CPA needs access saves a hiring-friction conversation later.

### P4 — Error correlation IDs + shared role-guard helper + convention linter

**Status:**
- P4.1 (correlation IDs on API error responses) CLOSED in commit `9338211`. 10 highest-leverage routes retrofitted; new `lib/error-response.ts` helper with structured Better Stack logging; Sentry paged only for internal errors; 19 new tests.
- P4.2 (shared role-guard helper) CLOSED in commit `95b7904`. New `lib/auth-guard.ts` with 4 convenience helpers + 2 primitives. 15 routes retrofitted; 13 gain correlationId coverage as a P4.1 free-rider. 20 new tests. Catch-order invariant awk-verified across all retrofits.
- P4.3 (convention linter) OPEN.

**Problem:** Three related hygiene gaps.
1. Generic 403s have no correlation ID — hard to debug when a nonprofit admin reports "I can't approve."
2. Role-guard pattern is copy-pasted across 95 handlers — divergence risk.
3. No linter rule enforcing "platform endpoints must be under `/api/platform/`."

**Fix:**
1. In `lib/error-response.ts`, add a helper that generates `{ error, correlationId }` and logs the correlationId with full context. Retrofit top 10 handlers; expand over time.
2. In `lib/permissions.ts` (extend existing file), add `requirePlatformAdmin(session)` / `requireNonprofitAdmin(session)` / `requireBeneficiary(session)` helpers that encapsulate the check + 403 pattern. Retrofit gradually.
3. ESLint custom rule or regex-based grep in CI that flags: any handler that queries `User` or `Organization` but is not under `/api/platform/` AND does not include a role-scoped `where`.

**Scope:** 3–5 hours total across the three fixes.

**BSRS section:** "A Policy Framework for Authentication and Authorization Decisions" (§5.4), "Diagnosing Access Denials" (§5.3).

**Priority rationale:** incremental hygiene, each piece is independently useful. Not blocking but compounds well.

### P5 — Policy framework + AuditLog immutability + retention

**Problem:** Three "eventual" fixes that aren't urgent but should be sequenced.

1. **Policy framework** — the `policy.check({ action, resource, actor })` pattern from §4. Major refactor; ~40+ hours. Only worth doing after a second developer exists or after the role model grows beyond 5.
2. **AuditLog immutability** — prevent app-runtime tampering. Options: (a) write to a separate DB with append-only permissions, (b) use PostgreSQL triggers to reject UPDATE/DELETE on AuditLog, (c) ship rows to an external log store (Better Stack already wired, but it's for debug logs, not compliance audit).
3. **AuditLog retention** — delete or archive rows older than N years. GDPR requires this for user-related rows; SOX/PCI recommends 7+ years for financial. Needs a formal policy before implementation.

**Scope:** each is multi-hour. Don't ship any tonight or tomorrow. Write a design doc per sub-item as needed.

**BSRS section:** "A Policy Framework for Authentication and Authorization Decisions" (§5.4); BSRS Ch 15 will cover immutability/retention in depth.

**Priority rationale:** deferrable — but track them explicitly so they don't silently expire from attention.

---

## 8. Deferred to BSRS Ch 8 (Resilience) and Ch 15 (Investigating Systems)

Several topics Ch 5 touches will get fuller treatment later:
- **Immutable logging design** (Ch 15) — P5.2 above
- **Log retention** (Ch 15) — P5.3 above
- **Defense in depth** (Ch 8) — the Prisma middleware is one layer; CHECK constraints are another; type-level `OrgScopedString` (if shipped per Ch 12) would be a third
- **Controlling blast radius** (Ch 8) — the multi-tenant org separation IS blast radius control; will re-evaluate in Ch 8 context

---

## 9. Summary table

| # | Gap | Scope | BSRS section | Status |
|---|---|---|---|---|
| P1 | Cross-org isolation regression test suite | 4–6 hrs | §5.3 Testing of least privilege | Option A closed in `907c657`; Option B open |
| P2 | Access classification doc + audit review cadence + high-risk justifications | 2–3 hrs | §5.2 Classification, §5.3 Auditing | CLOSED in `69ea0d1`; P2b open |
| P2b | Beneficiary deactivation reason-gate + shared reason-modal UI | 2–4 hrs | §5.3 Auditing | Open |
| P3 | Expiring role grants (CPA-season + future hires) | 4–6 hrs | §5.5 Temporary Access | Open |
| P4 | Correlation IDs + role-guard helper + convention linter | 3–5 hrs | §5.3 Diagnosing, §5.4 Policy Framework | P4.1 closed in `9338211`; P4.2 closed in `95b7904`; P4.3 open |
| P5 | Policy framework + AuditLog immutability + retention policy | Multi-session | §5.4, defers to Ch 15 | Deferred |

---

## 10. What's already strong (don't let the gap list distract from this)

BenefitsSafe has, right now, more BSRS Ch 5 discipline than most startups at this stage:

- **Every money-flow path uses `$transaction` with Serializable isolation + retry** (DDIA Ch 7 work, 2026-04-17)
- **Zero cross-org leaks** across 70 adversarially audited queries (2026-04-17)
- **DB-level CHECK constraints** as belt-and-suspenders against code bugs (commit `07c6611`)
- **AuditLog on every money action + every platform action** (reinforced in commit `54926d8`)
- **Runtime defense-in-depth middleware** (commit `9428032`) collecting shadow telemetry right now
- **Breakglass pattern established** (commit `854a984` / `3d95348`) — platform_admin, zod reason, atomic audit, UI + CLI access, runbook
- **Documented operational runbooks** for credential rotation, stuck grants, middleware enablement
- **API surface is small and functional** — no meta-endpoints, no SQL-as-a-service, no arbitrary-command runner

The gap list above is upgrades from "strong" to "Google-scale strong." It's not a list of holes in a broken system.

---

**End of applied document.**

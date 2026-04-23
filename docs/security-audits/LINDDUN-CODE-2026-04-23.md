# LINDDUN-CODE Audit — 2026-04-23

**Scope:** code-path LINDDUN covering 4 of 7 letters — **D**isclosure, **N**on-compliance, **D**etectability, **N**on-repudiation (privacy sense). **L**inkability, **I**dentifiability, and **U**nawareness are deferred to a future **LINDDUN-ops** PDR because those categories depend on observing real traffic, real log volume under load, real analytics behavior, and a privacy-policy-vs-actual-collection audit — all of which require customer data to produce actionable (not theoretical) findings.

**Prerequisite:** [docs/CTM-BASELINE.md](../CTM-BASELINE.md) — this audit references Crown Jewels entries (`CJ-N`) and Trust Boundaries (`TB-N`) by ID.

**Reference:** Tarandach & Coles, *Threat Modeling* (O'Reilly 2020), Chapter 3 — Specialized Methodologies, LINDDUN.

**Output artifacts produced by this audit:**
1. This findings document.
2. Tiny-fix code changes in [app/api/user/data-export/route.ts](../../app/api/user/data-export/route.ts) — shipped in the same merge.
3. OQ-15 through OQ-22 appended to [docs/CTM-BASELINE.md §6](../CTM-BASELINE.md) for deferred items.
4. Rows appended to [/DEPENDENCY_AUDIT.md](../../DEPENDENCY_AUDIT.md) per its column schema with `privacy-code` source tag.

---

## Summary

| Finding | Letter | Severity | Regulation | Decision | Ships this merge |
|---------|--------|----------|------------|----------|:----------------:|
| **D-1** | Disclosure | **Critical** | CCPA §1798.110 · GDPR Art. 15 | fix (partial) + defer (remainder) | Yes (5 tables); OQ-15/16/17 for remainder |
| **N-1** | Non-compliance | **High** | CCPA §1798.105 · GDPR Art. 17 | defer | No — OQ-18 |
| **N-2** | Non-compliance | Medium | CCPA §1798.105 · GDPR Art. 17 | defer | No — OQ-19 |
| **N-4** | Non-compliance | Medium | CCPA §1798.130(a)(2) · GDPR Art. 12(6) | defer | No — OQ-20 |
| **D-det** | Detectability | — | — | no finding | N/A — absence documented below |
| **Nnr-1** | Non-repudiation (privacy) | Low | GDPR Art. 5(1)(c) | defer | No — OQ-21 |
| **Nnr-2** | Non-repudiation (privacy) | Low | GDPR Art. 5(1)(e) | defer | No — OQ-22 |

**Total findings: 7** (6 actionable + 1 explicit no-finding for D-detectability).
**Shipped this merge: 1 code fix** (D-1 partial — 5 tables added to data-export).
**Deferred to future PDRs: 6 findings → OQ-15 through OQ-22.**

---

## §1 D — Disclosure (data-export completeness)

**Finding D-1 — Critical** — `/api/user/data-export` returns only 6 of 11+ user-referencing tables, violating CCPA §1798.110 (right to know "the specific pieces of personal information the business has collected") and GDPR Art. 15 (right of access to all personal data).

**Evidence:** [app/api/user/data-export/route.ts](../../app/api/user/data-export/route.ts) current exports — `User` (profile, minus `passwordHash`/`ssnLast4`/`mfaSecret` — correctly excluded per `CJ-2`); `Grant` (where user is beneficiary); `ExpenseRequest` (where user is requester); `Document` (uploadedBy OR entityType=beneficiary); `VirtualCard` (where user is beneficiary); `AuditLog` (top 100 rows).

**Schema gap analysis.** Tables with FK columns pointing at `User.id` (enumerated from `prisma/schema.prisma`):

| Model | FK column | Currently exported? |
|-------|-----------|:-------------------:|
| `User` | (self) | ✓ (with `passwordHash`/`ssnLast4`/`mfaSecret` correctly redacted) |
| `Grant` | `beneficiaryId` | ✓ |
| `ExpenseRequest` | `requestedById` | ✓ |
| `Document` | `uploadedById` + `entityId` | ✓ (both paths) |
| `VirtualCard` | `beneficiaryId` | ✓ |
| `AuditLog` | `userId` | ⚠ capped at 100 (OQ-16) |
| `OrganizationMembership` | `userId` | **✗** |
| `InviteToken` | `userId` | **✗** |
| `Approval` | `approverId` | **✗** (relevant for non-beneficiary roles) |
| `Notification` | `userId` | **✗** |
| `CardholderEligibility` | `beneficiaryId` (`@unique`) | **✗** |
| `Message` | via `ConversationParticipant.userId` | **✗** — policy decision (OQ-15) |
| `ConversationParticipant` | `userId` | **✗** — policy decision (OQ-15) |
| `Transaction` | (via `VirtualCard.beneficiaryId` — transitive) | **✗** — needs JOIN (OQ-17) |
| `Vendor` | `userId` (optional, only when vendor has user account) | **✗** — vendor-role edge case |

**Tiny-fix-now (shipping this merge):** add 5 missing tables whose FK is direct and whose field-selection has no design ambiguity:

1. `OrganizationMembership` — user's per-org memberships (id, organizationId, role, memberCode, notes, createdAt). `notes` included per GDPR Art. 15 — users are entitled to see admin annotations about themselves.
2. `InviteToken` — tokens issued to the user (id, method, sentTo, createdAt, expiresAt, usedAt). `sentTo` is the user's own email.
3. `Approval` — approval decisions where the user was the approver (id, action, expenseId, createdAt). `notes` **excluded** — free-text may embed cross-user PII; conservative default.
4. `Notification` — (id, type, title, entityType, entityId, read, createdAt). `message` body **excluded** — may contain other users' PII (e.g., "Jane Smith submitted an expense"); conservative default.
5. `CardholderEligibility` — (id, eligibilityStatus, ofacScreened, ofacScreenedAt). `probationParoleRestrictions` free-text field **excluded** — may embed details beyond user's own data.

**Deferred remainder** (see OQ-15/16/17):
- `Message` / `ConversationParticipant` — scope decision (which messages? just the user's own sent messages? or all messages in conversations they participate in, which would include other participants' content?). Requires policy call.
- `Transaction` — reachable via `VirtualCard.beneficiaryId` JOIN; 20+ lines to implement cleanly.
- `AuditLog` 100-row cap — GDPR Art. 15 expects full history; needs pagination + performance design.

---

## §2 N — Non-compliance (data-deletion cascade coverage)

Two routes exist: [app/api/user/data-deletion/route.ts](../../app/api/user/data-deletion/route.ts) (self-service, beneficiary-only) and [app/api/admin/data-deletion/route.ts](../../app/api/admin/data-deletion/route.ts) (admin-initiated, `platform_admin` or `nonprofit_admin` within org).

**Observation — admin route is strong.** The admin route already does a $transaction-wrapped sequence: anonymize `User` row → scrub `AuditLog.oldValue`/`newValue` JSON blobs via `jsonb_object_agg` with a `PII_KEYS` redaction list (19 keys) → archive uploaded `Document` rows → cancel active `VirtualCard` rows → write a non-PII `admin_data_deletion` audit entry. CCPA §1798.105 + GDPR Art. 17 compliance posture is strong on the admin path.

**AuditLog is NOT cascade-deleted on User deletion** — confirmed. The row is preserved (legal evidence per `CJ-7`), only the PII values inside `oldValue`/`newValue` JSON are replaced with `"[REDACTED]"`. Matches access-classification.md guidance: *"AuditLog should NOT cascade-delete (legal evidence) — deletion must anonymize the userId, not remove the row."* ✓ Correct.

### Finding N-1 — High — self-service deletion does NOT scrub AuditLog PII

**Evidence:** [app/api/user/data-deletion/route.ts](../../app/api/user/data-deletion/route.ts) anonymizes the `User` row and cancels active `VirtualCard`s but performs **no `AuditLog.oldValue`/`newValue` scrub** and **no document archive**. The admin route's own header comment (lines 4–18) explicitly identifies this as a known gap in the self-service path:

> *"The self-service /api/user/data-deletion route only anonymizes the User row, leaving PII sitting in the audit trail JSON blobs forever. CCPA requires deletion of ALL stored PII, not just the canonical user record."*

**Impact:** beneficiary-initiated CCPA/GDPR deletion requests leave the beneficiary's PII (name, email, DOB, address) embedded in `AuditLog.newValue` JSON blobs indefinitely — in rows produced by routes like `/api/grants/[id]/issue-card`, `/api/memberships/invite`, `/api/auth/reset-password` that embed `{ beneficiary: "First Last", email: ..., phone: ... }`. CCPA §1798.105 requires deletion of "all stored PII" — not just the canonical `User` row.

**Why this is High, not tiny-fix-now:** the robust fix is to extract a shared deletion helper into `lib/data-deletion.ts` and call it from both routes. Inline duplication (copy the admin route's `$transaction` + `PII_KEYS` + two `$executeRaw` UPDATEs into the self-service route) is ~50 lines of code duplication, violates DRY, and creates a drift hazard (PII_KEYS keyed in two places would rot separately). Deferred to **OQ-18**.

### Finding N-2 — Medium — `Message.content` and `Conversation.title` are not anonymized on deletion

**Evidence:** neither deletion route touches `Message` rows. `Message.content` (per `prisma/schema.prisma`) is free-text the user typed; deletion of the user leaves their messages verbatim in conversations with other participants.

**Why deferred:** policy decision. Options: (a) anonymize `Message.content` → `"[deleted]"` by `senderId`; (b) soft-delete the user's messages (hide from others); (c) leave intact (other participants have a legitimate interest in the conversation record). Each has regulator-vs-UX trade-offs. Needs a design call. **OQ-19**.

### Finding N-4 — Medium — no verification step on self-service deletion

**Evidence:** [app/api/user/data-deletion/route.ts:13-56](../../app/api/user/data-deletion/route.ts#L13) — a single authenticated `POST` irreversibly anonymizes the `User` row. No email confirmation, no cooling-off period, no re-authentication prompt.

**Regulation:** CCPA §1798.130(a)(2) requires "two or more methods for submitting requests" + verification; GDPR Art. 12(6) allows the controller to "request the provision of additional information necessary to confirm the identity of the data subject." A session cookie is identity, but one-click destructive actions on restricted-fund financial accounts (beneficiary cards still linked to grants) deserve a confirmation step.

**Why deferred:** requires email-confirmation token flow + cooling-off UI. **OQ-20**.

*(Numbering note: N-3 was allocated to emergency-contact anonymization during analysis but closed as not-a-finding — the self-service route already clears `emergencyContactName` + `emergencyContactPhone` on line 49–50.)*

---

## §3 D — Detectability (response-shape symmetry)

**Finding D-det — NO ISSUE FOUND.** The 5 priority resource-by-ID routes were probed for the "exists but you can't access" vs "doesn't exist" leak pattern:

| Route | Role-check position | Resource-lookup position | Verdict |
|-------|---------------------|--------------------------|---------|
| [app/api/beneficiaries/[id]/route.ts](../../app/api/beneficiaries/[id]/route.ts#L126) | L126 — before lookup | L156, L312 — `not_found` returned for both missing AND cross-org | ✓ Symmetric |
| [app/api/grants/[id]/route.ts](../../app/api/grants/[id]/route.ts#L42) | L42 — vendor role blocked before lookup | L72, L194, L308 — `not_found` for missing + cross-org (the `where: { id, organizationId }` filter ensures cross-org returns null → 404) | ✓ Symmetric |
| [app/api/expenses/[id]/route.ts](../../app/api/expenses/[id]/route.ts#L52) | L52, L140, L267 — before lookup | L98, L182, L295 — 404 for missing + scope-mismatch | ✓ Symmetric |
| [app/api/users/[id]/route.ts](../../app/api/users/[id]/route.ts#L53) | L53, L161, L280 — before lookup | L76, L172, L180, L295 — 404 consistent | ✓ Symmetric |
| [app/api/vendors/[id]/route.ts](../../app/api/vendors/[id]/route.ts#L50) | (handled at kind=not_found) | L50, L166, L232 — 404 for missing + cross-org | ✓ Symmetric |

**Why this is the correct pattern:** role checks fire **before** any resource lookup, so an unauthorized role gets `403` regardless of whether the resource exists. Authorized users hitting missing-or-cross-org IDs both get `404`. Cross-org probing by a legitimate user (e.g., a `nonprofit_admin` guessing another org's grant ID) returns `404` — same as a truly non-existent ID — so existence cannot be inferred from response-code alone. Cross-referenced with the 2026-04-17 [cross-org isolation audit](../audits/README.md) which found **0 true cross-org leaks** across 742 Prisma queries. No detectability finding.

---

## §4 N — Non-repudiation (privacy sense) — AuditLog granularity

### Finding Nnr-1 — Low — `AuditLog.ipAddress` + `AuditLog.userAgent` retained indefinitely

**Evidence:** `prisma/schema.prisma` — `AuditLog` model has `ipAddress: String?` and `userAgent: String?` columns; `docs/cascade-behavior.md:73` states AuditLog is "Retain indefinitely (compliance requirement)." IP + UA are personal data under GDPR Art. 4(1).

**Tension:** these fields are load-bearing for the session-fingerprinting fraud detection logic in `middleware.ts` (see `CJ-6` / `TB-1`). Can't just remove them. GDPR Art. 5(1)(c) (data minimization) argues for trimming; GDPR Recital 49 (network security as "legitimate interest") argues for retention.

**Why deferred:** requires a retention policy design — e.g., null out `ipAddress`/`userAgent` after 90 days for low-severity actions; keep indefinitely for security-relevant actions (`mfa_disable`, `password_reset`, etc.). Needs an action-taxonomy review + cron job. **OQ-21**.

### Finding Nnr-2 — Low — No explicit AuditLog retention policy beyond "indefinitely"

**Evidence:** `docs/cascade-behavior.md:71-74` sets retention as "Retain indefinitely (compliance requirement)." No explicit cite for which compliance requirement. SOX (~7 years for financial records) and IRS §501(c)(3) records retention (7 years) are defensible anchors, but "indefinitely" is broader than either.

**Why deferred:** requires a documented retention policy with per-action TTLs, tied to regulatory anchors (SOX, IRS, Cal. Corp. Code), and a cron job or table-partitioning strategy to enforce deletion of rows past retention. **OQ-22**.

---

## §5 Code changes shipped in this merge

**File:** [app/api/user/data-export/route.ts](../../app/api/user/data-export/route.ts)

**Change:** 5 additional Prisma queries added to the `Promise.all([...])` block, 5 additional keys in the response JSON. Field-selection is conservative — excludes free-text fields (`Approval.notes`, `Notification.message`, `CardholderEligibility.probationParoleRestrictions`) that could embed cross-user PII. Diff shown in the staged output before commit.

**Crown Jewels affected:** `CJ-1` (Beneficiary PII) — change *improves* user's confidentiality posture (fuller exercise of right-to-know) without changing the attack surface.

**Trust Boundaries crossed:** `TB-1` (user ↔ app) — no change to boundary enforcement; only widens the legitimate data path on an already-authenticated route.

**Verification:** audit-only for the 5 deferred findings; code fix verified via the lint/build that runs in CI on the commit.

---

## §6 DEPENDENCY_AUDIT.md row shape reference

Rows appended to [/DEPENDENCY_AUDIT.md](../../DEPENDENCY_AUDIT.md) use the B-2 schema:

| Column | Value pattern for this audit |
|--------|------------------------------|
| Date | `2026-04-23` |
| Package | Route path or schema model (e.g., `/api/user/data-export`, `AuditLog model`) |
| Severity | `<severity> — LINDDUN-<letter> (<regulation>)` — e.g., `Critical — LINDDUN-D (CCPA §1798.110 + GDPR Art. 15)` |
| Prod/Dev | `prod` (privacy findings are always prod) |
| Exploitable | `Y`/`N` + one-line reachability |
| Decision | `fix` for shipped items; `defer` for OQ items |
| Fix version / override | concrete remediation or `audit-only — deferred to OQ-N` |
| Verification status | `audit-only` for deferred items; V-gates or `code fix + audit` for shipped |
| Deploy SHA | merge SHA for shipped; `n/a — audit-only` for deferred |

See the actual rows in [/DEPENDENCY_AUDIT.md](../../DEPENDENCY_AUDIT.md) (7 rows appended by this PDR).

---

## §7 Out-of-scope notes

- **L (Linkability), I (Identifiability), U (Unawareness)** — deferred to LINDDUN-ops PDR (post-customer). Reason repeated from opening: those letters need real traffic, log volume, analytics, and policy-vs-collection audit data.
- **STRIDE** — deferred to post-customer STRIDE PDR per the ordering established when this audit was scoped. Not in this PDR's scope.
- **Migration of bare-`NextResponse.json` routes** — expenses/[id] and users/[id] use bare error returns (pre-existing, tracked in OQ-3 via the auth-guard linter grandfather allowlist). Not in this PDR's scope — they would migrate to `errorResponse()` in a separate shrink-the-allowlist PDR, and their detectability behavior was verified correct regardless of error-shape.

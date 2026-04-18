import { describe, it, expect } from "vitest";
import { classifyQuery, type Classification } from "@/lib/prisma-org-scoping";
import type { OrgContext } from "@/lib/org-context";

/**
 * Unit tests for classifyQuery in lib/prisma-org-scoping.ts.
 *
 * These tests lock in the classifier's CURRENT behavior, including
 * 4 known false-positive cases documented in
 * docs/audits/cross-org-isolation-handler-has-org-stratified-2026-04-17.md
 * (the "classifier blind spots" — self-scoped userId, self-scoped
 * beneficiaryId, flat foreign-key scoping). These queries ARE safe
 * in practice (audited 40/40, zero real leaks) but trigger shadow_violation
 * at the middleware layer because the classifier is block-only and can't
 * trace variable binding, relational paths on flat FKs, or self-scoping.
 *
 * If the classifier is upgraded to eliminate these blind spots, update
 * these tests. Until then, the false-positive tests are regression guards
 * against unintended classifier changes that would break shadow-mode
 * telemetry.
 *
 * Subject under test: lib/prisma-org-scoping.ts (commit 9428032 baseline).
 * Reference: docs/design-notes/bsrs-ch05-least-privilege-applied.md §7 P1
 */

const ORG_A = "org_A";
const ORG_B = "org_B";
const USER_1 = "user_1";

const sessionCtx: OrgContext = {
  kind: "session",
  organizationId: ORG_A,
  userId: USER_1,
  role: "nonprofit_admin",
};

function allowed(c: Classification): c is { kind: "allowed"; reason: string } {
  return c.kind === "allowed";
}

describe("classifyQuery", () => {
  // -------------------------------------------------------------------
  // Model set classification
  // -------------------------------------------------------------------

  describe("non-org-scoped models", () => {
    it("allows InviteToken regardless of context", () => {
      const result = classifyQuery("InviteToken", "findFirst", { where: { token: "abc" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "non_org_scoped_model" });
    });

    it("allows PromoCode regardless of context", () => {
      const result = classifyQuery("PromoCode", "findMany", {}, undefined);
      expect(result).toEqual({ kind: "allowed", reason: "non_org_scoped_model" });
    });

    it("allows Message regardless of context", () => {
      const result = classifyQuery("Message", "create", { data: { content: "hi" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "non_org_scoped_model" });
    });
  });

  describe("unknown models", () => {
    it("allows model outside both sets with unknown_model reason", () => {
      const result = classifyQuery("Account", "findFirst", { where: { id: "a1" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "unknown_model" });
    });
  });

  // -------------------------------------------------------------------
  // Context gating
  // -------------------------------------------------------------------

  describe("missing context", () => {
    it("flags Grant findMany with undefined ctx as no_context shadow_violation", () => {
      const result = classifyQuery("Grant", "findMany", { where: { organizationId: ORG_A } }, undefined);
      expect(result).toEqual({ kind: "shadow_violation", details: "no_context" });
    });

    it("flags User update with undefined ctx as no_context shadow_violation", () => {
      const result = classifyQuery("User", "update", { where: { id: "u1" } }, undefined);
      expect(result).toEqual({ kind: "shadow_violation", details: "no_context" });
    });
  });

  describe("exempt contexts", () => {
    it("allows CRON exempt", () => {
      const ctx: OrgContext = { kind: "exempt", reason: "CRON" };
      const result = classifyQuery("Grant", "findMany", { where: {} }, ctx);
      expect(result).toEqual({ kind: "allowed", reason: "exempt:CRON" });
    });

    it("allows WEBHOOK_DERIVE exempt", () => {
      const ctx: OrgContext = { kind: "exempt", reason: "WEBHOOK_DERIVE" };
      const result = classifyQuery("Subscription", "update", { where: { id: "s1" } }, ctx);
      expect(result).toEqual({ kind: "allowed", reason: "exempt:WEBHOOK_DERIVE" });
    });

    it("allows AUTH_FLOW exempt", () => {
      const ctx: OrgContext = { kind: "exempt", reason: "AUTH_FLOW" };
      const result = classifyQuery("User", "findUnique", { where: { email: "a@b.co" } }, ctx);
      expect(result).toEqual({ kind: "allowed", reason: "exempt:AUTH_FLOW" });
    });

    it("allows PLATFORM_ADMIN exempt", () => {
      const ctx: OrgContext = { kind: "exempt", reason: "PLATFORM_ADMIN" };
      const result = classifyQuery("Organization", "findMany", { where: {} }, ctx);
      expect(result).toEqual({ kind: "allowed", reason: "exempt:PLATFORM_ADMIN" });
    });

    it("allows PLATFORM_METRIC exempt", () => {
      const ctx: OrgContext = { kind: "exempt", reason: "PLATFORM_METRIC" };
      const result = classifyQuery("Grant", "count", { where: {} }, ctx);
      expect(result).toEqual({ kind: "allowed", reason: "exempt:PLATFORM_METRIC" });
    });

    it("allows STATS_ADMIN exempt", () => {
      const ctx: OrgContext = { kind: "exempt", reason: "STATS_ADMIN" };
      const result = classifyQuery("AuditLog", "findMany", { where: {} }, ctx);
      expect(result).toEqual({ kind: "allowed", reason: "exempt:STATS_ADMIN" });
    });
  });

  // -------------------------------------------------------------------
  // Create / upsert / createMany
  // -------------------------------------------------------------------

  describe("session context — create operations", () => {
    it("allows create with data.organizationId matching ctx", () => {
      const result = classifyQuery(
        "Grant",
        "create",
        { data: { organizationId: ORG_A, title: "G1" } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "create_matches_ctx" });
    });

    it("flags create with missing data.organizationId", () => {
      const result = classifyQuery("Grant", "create", { data: { title: "G1" } }, sessionCtx);
      expect(result).toEqual({
        kind: "shadow_violation",
        details: "create_data_missing_or_mismatch",
      });
    });

    it("flags create with data.organizationId mismatching ctx", () => {
      const result = classifyQuery(
        "Grant",
        "create",
        { data: { organizationId: ORG_B, title: "G1" } },
        sessionCtx,
      );
      expect(result).toEqual({
        kind: "shadow_violation",
        details: "create_data_missing_or_mismatch",
      });
    });

    it("flags upsert with data.organizationId mismatch", () => {
      const result = classifyQuery(
        "Vendor",
        "upsert",
        { data: { organizationId: ORG_B, name: "V" } },
        sessionCtx,
      );
      expect(result).toEqual({
        kind: "shadow_violation",
        details: "upsert_data_missing_or_mismatch",
      });
    });
  });

  describe("session context — createMany", () => {
    it("allows createMany when all rows match ctx org", () => {
      const result = classifyQuery(
        "LedgerEntry",
        "createMany",
        { data: [{ organizationId: ORG_A, amount: 10 }, { organizationId: ORG_A, amount: 20 }] },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "createMany_matches_ctx" });
    });

    it("flags createMany when any row missing or mismatching org", () => {
      const result = classifyQuery(
        "LedgerEntry",
        "createMany",
        { data: [{ organizationId: ORG_A }, { organizationId: ORG_B }] },
        sessionCtx,
      );
      expect(result).toEqual({
        kind: "shadow_violation",
        details: "createMany_row_missing_or_mismatch",
      });
    });
  });

  // -------------------------------------------------------------------
  // Direct org-match — 11 audit rows (1, 2, 5, 8-11, 14, 17, 19, 30)
  // -------------------------------------------------------------------

  describe("session context — direct_org_match (audit rows 1,2,5,8-11,14,17,19,30)", () => {
    it("row 1: AuditLog findMany with where.organizationId", () => {
      const result = classifyQuery(
        "AuditLog",
        "findMany",
        { where: { organizationId: ORG_A, action: "READ" } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "direct_org_match" });
    });

    it("row 2: Vendor findMany with where.organizationId and archivedAt", () => {
      const result = classifyQuery(
        "Vendor",
        "findMany",
        { where: { organizationId: ORG_A, archivedAt: null } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "direct_org_match" });
    });

    it("row 5: Grant findMany role-branched with where.organizationId", () => {
      const result = classifyQuery(
        "Grant",
        "findMany",
        { where: { organizationId: ORG_A, status: "ACTIVE" } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "direct_org_match" });
    });

    it("row 8: ExpenseRequest count with where.organizationId", () => {
      const result = classifyQuery(
        "ExpenseRequest",
        "count",
        { where: { organizationId: ORG_A, status: "PENDING" } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "direct_org_match" });
    });

    it("row 9: VirtualCard findMany with where.organizationId", () => {
      const result = classifyQuery(
        "VirtualCard",
        "findMany",
        { where: { organizationId: ORG_A, status: "ACTIVE" } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "direct_org_match" });
    });

    it("row 10: Document findMany with where.organizationId", () => {
      const result = classifyQuery(
        "Document",
        "findMany",
        { where: { organizationId: ORG_A } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "direct_org_match" });
    });

    it("row 11: CalendarEvent findMany with where.organizationId", () => {
      const result = classifyQuery(
        "CalendarEvent",
        "findMany",
        { where: { organizationId: ORG_A, startsAt: { gte: new Date() } } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "direct_org_match" });
    });

    it("row 14: Notification findMany with where.userId + where.organizationId", () => {
      const result = classifyQuery(
        "Notification",
        "findMany",
        { where: { userId: USER_1, organizationId: ORG_A } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "direct_org_match" });
    });

    it("row 17: Subscription findMany with where.organizationId", () => {
      const result = classifyQuery(
        "Subscription",
        "findMany",
        { where: { organizationId: ORG_A, status: "ACTIVE" } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "direct_org_match" });
    });

    it("row 19: OrganizationMembership findMany with where.organizationId", () => {
      const result = classifyQuery(
        "OrganizationMembership",
        "findMany",
        { where: { organizationId: ORG_A, status: "active" } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "direct_org_match" });
    });

    it("row 30: Grant findMany role-branched (lib/data) with where.organizationId", () => {
      const result = classifyQuery(
        "Grant",
        "findMany",
        { where: { organizationId: ORG_A, archivedAt: null } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "direct_org_match" });
    });
  });

  // -------------------------------------------------------------------
  // byid_implicit — 14 audit rows (3, 4, 6, 7, 12, 13, 18, 20-24, 26, 28)
  // -------------------------------------------------------------------

  describe("session context — byid_implicit (audit rows 3,4,6,7,12,13,18,20-24,26,28)", () => {
    it("row 3: Vendor update by id only (precondition findFirst scoped upstream)", () => {
      const result = classifyQuery("Vendor", "update", { where: { id: "v1" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 4: Vendor update (approve route) by id only", () => {
      const result = classifyQuery("Vendor", "update", { where: { id: "v1" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 6: Grant update by id only (document PATCH branch)", () => {
      const result = classifyQuery("Grant", "update", { where: { id: "g1" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 7: Grant update by id only (document DELETE branch)", () => {
      const result = classifyQuery("Grant", "update", { where: { id: "g1" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 12: CalendarEvent update by id only", () => {
      const result = classifyQuery("CalendarEvent", "update", { where: { id: "e1" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 13: CalendarEvent delete by id only", () => {
      const result = classifyQuery("CalendarEvent", "delete", { where: { id: "e1" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 18: Subscription update by id only", () => {
      const result = classifyQuery("Subscription", "update", { where: { id: "s1" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 20: User update by id only (multi-org-safe via membership precondition)", () => {
      const result = classifyQuery("User", "update", { where: { id: "u2" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 21: User update by id (globally-deactivate-last-membership case)", () => {
      const result = classifyQuery("User", "update", { where: { id: "u2" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 22: User update by id (beneficiaries route, membership-gated)", () => {
      const result = classifyQuery("User", "update", { where: { id: "u2" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 23: User update by id (self-scoped mfa disable)", () => {
      const result = classifyQuery("User", "update", { where: { id: USER_1 } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 24: User update by id (self-scoped data-deletion)", () => {
      const result = classifyQuery("User", "update", { where: { id: USER_1 } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 26: Organization update by id (server-derived from session)", () => {
      const result = classifyQuery("Organization", "update", { where: { id: ORG_A } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });

    it("row 28: WorkflowTrigger delete by id only", () => {
      const result = classifyQuery("WorkflowTrigger", "delete", { where: { id: "t1" } }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_implicit" });
    });
  });

  // -------------------------------------------------------------------
  // Exempt audit row (27 — platform-admin cross-org fleet monitoring)
  // -------------------------------------------------------------------

  describe("session context — platform-admin cross-org exempt (audit row 27)", () => {
    it("row 27: Organization findMany with PLATFORM_ADMIN exempt ctx (by-design cross-org)", () => {
      const ctx: OrgContext = { kind: "exempt", reason: "PLATFORM_ADMIN" };
      const result = classifyQuery(
        "Organization",
        "findMany",
        { where: { stripeAccountId: { not: null } } },
        ctx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "exempt:PLATFORM_ADMIN" });
    });
  });

  // -------------------------------------------------------------------
  // Classifier blind spots — 4 audit rows (15, 16, 25, 29)
  // These queries are SAFE in practice (handler-level guards) but trigger
  // shadow_violation because the classifier can't trace self-scoping or
  // flat foreign-key scoping. See file-header docblock for philosophy.
  // -------------------------------------------------------------------

  describe("classifier blind spots — known false-positives (audit rows 15,16,25,29)", () => {
    // KNOWN CLASSIFIER BLIND SPOT — row 15 — handler-level guard makes this safe; see stratified audit
    // Pattern: self-scoped userId IDOR guard (notifications/route.ts:99)
    it("row 15: Notification updateMany with self-scoped userId flagged (handler IDOR-guards)", () => {
      const result = classifyQuery(
        "Notification",
        "updateMany",
        { where: { id: "n1", userId: USER_1 } },
        sessionCtx,
      );
      expect(result).toEqual({
        kind: "shadow_violation",
        details: "session_mismatch:updateMany",
      });
    });

    // KNOWN CLASSIFIER BLIND SPOT — row 16 — handler-level guard makes this safe; see stratified audit
    // Pattern: self-scoped userId IDOR guard (notifications/route.ts:69)
    it("row 16: Notification deleteMany with self-scoped userId flagged (handler IDOR-guards)", () => {
      const result = classifyQuery(
        "Notification",
        "deleteMany",
        { where: { id: { in: ["n1", "n2"] }, userId: USER_1 } },
        sessionCtx,
      );
      expect(result).toEqual({
        kind: "shadow_violation",
        details: "session_mismatch:deleteMany",
      });
    });

    // KNOWN CLASSIFIER BLIND SPOT — row 25 — handler-level guard makes this safe; see stratified audit
    // Pattern: self-scoped beneficiaryId where beneficiaryId = session.user.id (user/data-deletion/route.ts:54)
    it("row 25: VirtualCard updateMany with self-scoped beneficiaryId flagged (caller-is-beneficiary guard)", () => {
      const result = classifyQuery(
        "VirtualCard",
        "updateMany",
        { where: { beneficiaryId: USER_1 } },
        sessionCtx,
      );
      expect(result).toEqual({
        kind: "shadow_violation",
        details: "session_mismatch:updateMany",
      });
    });

    // KNOWN CLASSIFIER BLIND SPOT — row 29 — handler-level guard makes this safe; see stratified audit
    // Pattern: flat grantId where grantId is pre-scoped via fetchGrantWithScope (reports/export/route.ts:303)
    it("row 29: ExpenseRequest findMany with flat grantId flagged (grant pre-scoped by handler)", () => {
      const result = classifyQuery(
        "ExpenseRequest",
        "findMany",
        { where: { grantId: "g1", createdAt: { gte: new Date() }, archivedAt: null } },
        sessionCtx,
      );
      expect(result).toEqual({
        kind: "shadow_violation",
        details: "session_mismatch:findMany",
      });
    });
  });

  // -------------------------------------------------------------------
  // Relational scoping happy path (not in audit — audit rows use flat-FK
  // variants; this covers the RELATIONAL_SCOPE map in prisma-org-scoping)
  // -------------------------------------------------------------------

  describe("session context — relational_org_match", () => {
    it("allows ExpenseRequest with where.grant.organizationId", () => {
      const result = classifyQuery(
        "ExpenseRequest",
        "findMany",
        { where: { grant: { organizationId: ORG_A } } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "relational_org_match" });
    });

    it("allows LedgerEntry with where.transaction.organizationId", () => {
      const result = classifyQuery(
        "LedgerEntry",
        "findMany",
        { where: { transaction: { organizationId: ORG_A } } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "relational_org_match" });
    });

    it("allows Approval with where.expenseRequest.grant.organizationId (2-hop)", () => {
      const result = classifyQuery(
        "Approval",
        "findMany",
        { where: { expenseRequest: { grant: { organizationId: ORG_A } } } },
        sessionCtx,
      );
      expect(result).toEqual({ kind: "allowed", reason: "relational_org_match" });
    });
  });

  // -------------------------------------------------------------------
  // Edge where shapes
  // -------------------------------------------------------------------

  describe("session context — edge where shapes", () => {
    it("allows when where is undefined (by-id no-where-shape)", () => {
      const result = classifyQuery("Grant", "findMany", {}, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_no_where_shape" });
    });

    it("allows when where is null (by-id no-where-shape)", () => {
      const result = classifyQuery("Grant", "findMany", { where: null }, sessionCtx);
      expect(result).toEqual({ kind: "allowed", reason: "byid_no_where_shape" });
    });

    it("flags multi-key where with no org and no relational match", () => {
      const result = classifyQuery(
        "Grant",
        "findMany",
        { where: { status: "ACTIVE", title: "X" } },
        sessionCtx,
      );
      expect(result).toEqual({
        kind: "shadow_violation",
        details: "session_mismatch:findMany",
      });
    });
  });

  // -------------------------------------------------------------------
  // Resilience — classifier fails open on internal errors (shadow mode
  // must never block a real query)
  // -------------------------------------------------------------------

  describe("classifier resilience", () => {
    it("fail-open with extension_error reason when args property access throws", () => {
      const throwingArgs = new Proxy(
        {},
        {
          get: () => {
            throw new Error("boom");
          },
        },
      );
      const result = classifyQuery("Grant", "findMany", throwingArgs, sessionCtx);
      expect(allowed(result)).toBe(true);
      expect((result as { kind: "allowed"; reason: string }).reason).toContain("extension_error");
      expect((result as { kind: "allowed"; reason: string }).reason).toContain("boom");
    });

    it("fail-open on create path when data property access throws", () => {
      const throwingArgs = new Proxy(
        {},
        {
          get: () => {
            throw new Error("create-boom");
          },
        },
      );
      const result = classifyQuery("Grant", "create", throwingArgs, sessionCtx);
      expect(allowed(result)).toBe(true);
      expect((result as { kind: "allowed"; reason: string }).reason).toContain("extension_error");
    });
  });
});

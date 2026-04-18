import { Prisma } from "@/lib/generated/prisma/client";
import { getOrgContext, type OrgContext } from "./org-context";

// From the 2026-04-17 cross-org isolation audit. See
// docs/design-notes/prisma-org-scoping-extension-design.md for the
// classification rationale behind each list.
const ORG_SCOPED_MODELS = new Set<string>([
  "Organization",
  "User",
  "OrganizationMembership",
  "Grant",
  "BudgetCategory",
  "ExpenseRequest",
  "Vendor",
  "Subscription",
  "VirtualCard",
  "Transaction",
  "LedgerEntry",
  "Approval",
  "AuditLog",
  "Document",
  "DisbursementPolicy",
  "FundTransfer",
  "Notification",
  "CalendarEvent",
  "Integration",
  "WorkflowTrigger",
  "WorkflowLog",
  "GrantReport",
  "UsageCounter",
  "CardholderEligibility",
  "PromoRedemption",
  "Conversation",
  "BillingSubscription",
]);

const NON_ORG_SCOPED_MODELS = new Set<string>([
  "InviteToken",
  "PromoCode",
  "CronCheckpoint",
  "ProcessedWebhookEvent",
  "Message",
  "ConversationParticipant",
]);

// Relational scoping map: child model → path to parent org.
// Keys: model name; Values: path of keys terminating at "organizationId".
const RELATIONAL_SCOPE: Record<string, string[]> = {
  ExpenseRequest: ["grant", "organizationId"],
  LedgerEntry: ["transaction", "organizationId"],
  Approval: ["expenseRequest", "grant", "organizationId"],
};

export type Classification =
  | { kind: "allowed"; reason: string }
  | { kind: "shadow_violation"; details: string };

/**
 * Exported for unit tests only. Production callers should
 * use orgScopingExtension() instead. Direct classification
 * is not a stable API surface — the return reason strings
 * may change as the classifier evolves.
 */
export function classifyQuery(
  model: string,
  operation: string,
  args: unknown,
  ctx: OrgContext | undefined,
): Classification {
  try {
    if (NON_ORG_SCOPED_MODELS.has(model)) {
      return { kind: "allowed", reason: "non_org_scoped_model" };
    }

    if (!ORG_SCOPED_MODELS.has(model)) {
      return { kind: "allowed", reason: "unknown_model" };
    }

    if (!ctx) {
      return { kind: "shadow_violation", details: "no_context" };
    }

    if (ctx.kind === "exempt") {
      return { kind: "allowed", reason: `exempt:${ctx.reason}` };
    }

    const a = args as {
      where?: Record<string, unknown>;
      data?: Record<string, unknown> | Array<Record<string, unknown>>;
    };

    if (operation === "create" || operation === "upsert") {
      const data = a.data;
      if (
        typeof data === "object" &&
        data !== null &&
        !Array.isArray(data) &&
        (data as Record<string, unknown>).organizationId === ctx.organizationId
      ) {
        return { kind: "allowed", reason: "create_matches_ctx" };
      }
      return {
        kind: "shadow_violation",
        details: `${operation}_data_missing_or_mismatch`,
      };
    }

    if (operation === "createMany") {
      const data = a.data;
      if (Array.isArray(data)) {
        const allMatch = data.every(
          (row) =>
            typeof row === "object" &&
            row !== null &&
            (row as Record<string, unknown>).organizationId === ctx.organizationId,
        );
        if (allMatch) {
          return { kind: "allowed", reason: "createMany_matches_ctx" };
        }
      }
      return {
        kind: "shadow_violation",
        details: "createMany_row_missing_or_mismatch",
      };
    }

    const where = a.where;
    if (typeof where !== "object" || where === null) {
      return { kind: "allowed", reason: "byid_no_where_shape" };
    }

    const whereObj = where as Record<string, unknown>;

    if (whereObj.organizationId === ctx.organizationId) {
      return { kind: "allowed", reason: "direct_org_match" };
    }

    const relPath = RELATIONAL_SCOPE[model];
    if (relPath) {
      let node: unknown = where;
      let ok = true;
      for (let i = 0; i < relPath.length - 1; i++) {
        const key = relPath[i];
        if (
          typeof node !== "object" ||
          node === null ||
          !(key in (node as Record<string, unknown>))
        ) {
          ok = false;
          break;
        }
        node = (node as Record<string, unknown>)[key];
      }
      if (ok && typeof node === "object" && node !== null) {
        const last = relPath[relPath.length - 1];
        if ((node as Record<string, unknown>)[last] === ctx.organizationId) {
          return { kind: "allowed", reason: "relational_org_match" };
        }
      }
    }

    if ("id" in whereObj && Object.keys(whereObj).length === 1) {
      return { kind: "allowed", reason: "byid_implicit" };
    }

    return {
      kind: "shadow_violation",
      details: `session_mismatch:${operation}`,
    };
  } catch (err) {
    return {
      kind: "allowed",
      reason: `extension_error:${(err as Error).message}`,
    };
  }
}

export function orgScopingExtension() {
  return Prisma.defineExtension({
    name: "org-scoping-shadow",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          try {
            const ctx = getOrgContext();
            const verdict = classifyQuery(
              model as string,
              operation as string,
              args,
              ctx,
            );
            if (verdict.kind === "shadow_violation") {
              console.warn(
                "[org_scoping_shadow]",
                JSON.stringify({
                  tag: "shadow_violation",
                  model,
                  operation,
                  details: verdict.details,
                  ctxKind: ctx?.kind ?? "none",
                }),
              );
            } else if (
              verdict.reason === "unknown_model" ||
              verdict.reason === "byid_implicit"
            ) {
              console.info(
                "[org_scoping_shadow]",
                JSON.stringify({
                  tag: "telemetry",
                  model,
                  operation,
                  reason: verdict.reason,
                }),
              );
            }
          } catch (err) {
            console.warn(
              "[org_scoping_shadow]",
              JSON.stringify({
                tag: "extension_error",
                err: (err as Error).message,
              }),
            );
          }
          return query(args);
        },
      },
    },
  });
}

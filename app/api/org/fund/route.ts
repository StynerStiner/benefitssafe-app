// @ts-nocheck
// POST /api/org/fund — Initiate inbound transfer (ACH from bank to Financial Account)
// GET  /api/org/fund — Get current Financial Account balance

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  stripeCircuit,
  CircuitOpenError,
  CircuitTimeoutError,
  CIRCUIT_OPEN_COOLDOWN_MS,
} from "@/lib/stripe-circuit";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { stripeIdempotencyKey } from "@/lib/stripe-idempotency";
import { z } from "zod";

const ROUTE_GET = "api/org/fund:GET";
const ROUTE_POST = "api/org/fund:POST";

function circuitErrorResponse(
  error: CircuitOpenError | CircuitTimeoutError,
  route: string,
  method: "GET" | "POST",
) {
  const retryAfterSeconds =
    error instanceof CircuitOpenError
      ? Math.ceil(error.cooldown_ms_remaining / 1000)
      : Math.ceil(CIRCUIT_OPEN_COOLDOWN_MS / 1000);
  return errorResponse({
    kind: "dependency_unavailable",
    message: "Stripe is currently unavailable; please retry.",
    route,
    method,
    retryAfterSeconds,
    cause: error,
  });
}

const fundTransferSchema = z.object({
  amount: z.number().positive("Amount must be a positive number"),
  bankPaymentMethodId: z.string().optional(),
  requestId: z.string().uuid("requestId must be a valid UUID v4"),
});

// GET — Retrieve Financial Account balance
export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        organizationId: true,
        role: true,
      },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: "User not associated with organization" },
        { status: 400 },
      );
    }

    const readOnlyRoles = ["nonprofit_staff", "auditor", "cpa"];
    const adminRoles = ["nonprofit_admin", "platform_admin"];
    if (!adminRoles.includes(user.role) && !readOnlyRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Only organization members can view fund balance" },
        { status: 403 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        stripeAccountId: true,
        stripeFinancialAccountId: true,
      },
    });

    if (!organization?.stripeAccountId || !organization?.stripeFinancialAccountId) {
      return NextResponse.json({
        balance: { cash: 0, inbound_pending: 0, outbound_pending: 0 },
        financialAccountId: null,
        transfers: [],
      });
    }

    const financialAccountId = organization.stripeFinancialAccountId;
    const stripeAccountId = organization.stripeAccountId;

    // Dev fallback: mock financial account IDs start with fa_mock_
    if (financialAccountId.startsWith("fa_mock_")) {
      return NextResponse.json({
        balance: { cash: 0, inbound_pending: 0, outbound_pending: 0 },
        financialAccountId,
        transfers: [],
        dev: true,
      });
    }

    try {
      // Retrieve the Financial Account to get balance
      const financialAccount = await stripeCircuit.run(
        `${ROUTE_GET}:stripe.treasury.financialAccounts.retrieve`,
        { mode: "read" },
        () => stripe.treasury.financialAccounts.retrieve(
          financialAccountId,
          { expand: ["financial_addresses"] },
          { stripeAccount: stripeAccountId },
        ),
      );

      // Get recent inbound transfers
      const inboundTransfers = await stripeCircuit.run(
        `${ROUTE_GET}:stripe.treasury.inboundTransfers.list`,
        { mode: "read" },
        () => stripe.treasury.inboundTransfers.list(
          {
            financial_account: financialAccountId,
            limit: 20,
          },
          { stripeAccount: stripeAccountId },
        ),
      );

      return NextResponse.json({
        balance: financialAccount.balance || { cash: { usd: 0 }, inbound_pending: { usd: 0 }, outbound_pending: { usd: 0 } },
        financialAccountId,
        transfers: inboundTransfers.data.map((t) => ({
          id: t.id,
          amount: t.amount,
          currency: t.currency,
          status: t.status,
          created: t.created,
          description: t.description,
        })),
      });
    } catch (stripeError) {
      // Pattern β: bubble circuit errors to outer catch for 503 mapping.
      if (stripeError instanceof CircuitOpenError || stripeError instanceof CircuitTimeoutError) throw stripeError;
      console.warn("Failed to retrieve Treasury balance (dev mode?):", stripeError);
      return NextResponse.json({
        balance: { cash: 0, inbound_pending: 0, outbound_pending: 0 },
        financialAccountId,
        transfers: [],
        dev: true,
      });
    }
  } catch (error) {
    if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) {
      return circuitErrorResponse(error, ROUTE_GET, "GET");
    }
    console.error("GET /api/org/fund error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve fund balance" },
      { status: 500 },
    );
  }
}

// POST — Initiate inbound transfer from nonprofit's bank to Financial Account
export async function POST(request: Request): Promise<NextResponse> {
  try {
    await assertDbHealthy();
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        organizationId: true,
        role: true,
      },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: "User not associated with organization" },
        { status: 400 },
      );
    }

    if (user.role !== "nonprofit_admin" && user.role !== "platform_admin") {
      return NextResponse.json(
        { error: "Only organization admins can initiate fund transfers" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = fundTransferSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const fields = Object.keys(fieldErrors);
      return NextResponse.json(
        { error: "Validation failed", invalidFields: fields },
        { status: 400 },
      );
    }

    const { amount, bankPaymentMethodId: requestedPaymentMethodId, requestId } = parsed.data;

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        stripeAccountId: true,
        stripeFinancialAccountId: true,
        stripeOriginPaymentMethodId: true,
      },
    });

    if (!organization?.stripeAccountId || !organization?.stripeFinancialAccountId) {
      return NextResponse.json(
        { error: "Organization must complete Stripe onboarding first" },
        { status: 400 },
      );
    }

    // Default to the org's stored origin PaymentMethod (linked via
    // /api/org/link-bank) so the admin doesn't have to re-enter bank
    // details every time they fund. Still accept an explicit override
    // from the request body for ad-hoc usage.
    const bankPaymentMethodId = requestedPaymentMethodId || organization.stripeOriginPaymentMethodId;
    if (!bankPaymentMethodId) {
      return NextResponse.json(
        {
          error: "No funding bank account on file. Link a bank account in Organization Settings > Funding first.",
          href: "/org-settings",
        },
        { status: 400 },
      );
    }

    const financialAccountId = organization.stripeFinancialAccountId;
    const stripeAccountId = organization.stripeAccountId;
    const amountInCents = Math.round(amount * 100);

    // Dev mock path — no real Stripe call, so no FundTransfer row needed.
    // This means dev double-clicks produce duplicate audit logs, which is
    // acceptable because dev is not a production environment.
    if (financialAccountId.startsWith("fa_mock_")) {
      const mockId = crypto.randomUUID();
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: user.organizationId,
          action: "create",
          entityType: "fund_transfer",
          entityId: `mock_transfer_${mockId}`,
          newValue: {
            action: "inbound_transfer_initiated",
            requestId,
            amount: amountInCents,
            currency: "usd",
            dev: true,
          },
        },
      });

      return NextResponse.json({
        transfer: {
          id: `ibt_mock_${mockId}`,
          amount: amountInCents,
          currency: "usd",
          status: "processing",
          description: "Grant fund deposit (dev mock)",
        },
        dev: true,
      });
    }

    // DDIA Ch12 — end-to-end request ID pattern for ACH pull dedup.
    //
    // INSERT a FundTransfer row BEFORE calling Stripe. The compound
    // unique constraint @@unique([organizationId, requestId]) is the
    // dedup gate: a retry with the same requestId hits a P2002 unique
    // violation, and we return the existing row's state instead of
    // calling Stripe again. This survives any retry window — there is
    // no time bucket to roll over.
    //
    // TODO(reconciliation): if anything between this INSERT and the
    // stripe.treasury.inboundTransfers.create call below errors —
    // CircuitOpenError, CircuitTimeoutError, Stripe 5xx, network
    // reset — this row stays PENDING and a same-requestId retry
    // hits P2002 → 409 "in_progress" indefinitely. The race existed
    // pre-circuit but surfaces more reliably now that circuit-open
    // is a distinct failure mode. Follow-up: reconciliation cron
    // that sweeps PENDING FundTransfers older than N minutes and
    // either reconciles against Stripe or marks FAILED so the admin
    // can retry with a fresh requestId. Out of scope for BSRS Ch 8
    // P1b; tracked for Phase 2B.
    let fundTransfer;
    try {
      fundTransfer = await prisma.fundTransfer.create({
        data: {
          organizationId: user.organizationId,
          requestId,
          amountCents: amountInCents,
          currency: "usd",
          bankPaymentMethodId,
          stripeAccountId,
          financialAccountId,
          status: "PENDING",
          initiatedByUserId: session.user.id,
        },
      });
    } catch (err) {
      // P2002: unique constraint violation — this requestId was already
      // used. Fetch the existing row and return its state.
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        const existing = await prisma.fundTransfer.findUnique({
          where: {
            organizationId_requestId: {
              organizationId: user.organizationId,
              requestId,
            },
          },
        });

        if (!existing) {
          // Should not happen — P2002 implies the row exists. Defensive.
          return NextResponse.json(
            { error: "Fund transfer conflict — please retry with a new requestId" },
            { status: 500 },
          );
        }

        if (existing.status === "SUCCEEDED") {
          // Idempotency guarantee: return the stored state plainly.
          // The frontend can poll a separate status endpoint if it
          // needs the live Stripe status (future work).
          return NextResponse.json({
            transfer: {
              id: existing.stripeTransferId,
              amount: existing.amountCents,
              currency: existing.currency,
              status: "accepted",
              description: "Grant fund deposit",
              previouslyInitiated: true,
              initiatedAt: existing.createdAt,
            },
          });
        }

        if (existing.status === "PENDING") {
          return NextResponse.json(
            {
              error: "A fund transfer with this requestId is already in progress",
              code: "transfer_in_progress",
              transferId: existing.id,
              requestId: existing.requestId,
              retryable: true,
            },
            { status: 409 },
          );
        }

        // FAILED
        return NextResponse.json(
          {
            error: "This transfer previously failed. Please contact support or initiate a new transfer.",
            code: "transfer_failed",
            transferId: existing.id,
            requestId: existing.requestId,
            retryable: false,
          },
          { status: 422 },
        );
      }

      // Non-P2002 DB error — real problem.
      throw err;
    }

    // Deterministic Stripe idempotency key tied to the client-supplied
    // requestId. Survives any retry window. (Ch12 F7 — unified helper.)
    const idempotencyKey = stripeIdempotencyKey("ibt", user.organizationId, requestId);

    try {
      const transfer = await stripeCircuit.run(
        `${ROUTE_POST}:stripe.treasury.inboundTransfers.create`,
        { mode: "write" },
        () => stripe.treasury.inboundTransfers.create({
          financial_account: financialAccountId,
          amount: amountInCents,
          currency: "usd",
          origin_payment_method: bankPaymentMethodId,
          description: "Grant fund deposit",
        }, { stripeAccount: stripeAccountId, idempotencyKey }),
      );

      // Mark the FundTransfer as SUCCEEDED with the Stripe transfer ID.
      await prisma.fundTransfer.update({
        where: { id: fundTransfer.id },
        data: {
          status: "SUCCEEDED",
          stripeTransferId: transfer.id,
        },
      });

      // Audit log with full traceability.
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: user.organizationId,
          action: "create",
          entityType: "fund_transfer",
          entityId: fundTransfer.id,
          newValue: {
            action: "inbound_transfer_succeeded",
            requestId,
            stripeTransferId: transfer.id,
            amountCents: amountInCents,
            currency: "usd",
            status: "SUCCEEDED",
          },
        },
      });

      return NextResponse.json({
        transfer: {
          id: transfer.id,
          amount: transfer.amount,
          currency: transfer.currency,
          status: transfer.status,
          description: transfer.description,
        },
      });
    } catch (stripeError) {
      // Pattern β: bubble circuit errors to outer catch for 503 mapping.
      // Circuit open/timeout must not be recorded as a terminal FAILED
      // transfer — it's a transient dependency outage, and the caller
      // should retry with the same requestId once cooldown elapses.
      if (stripeError instanceof CircuitOpenError || stripeError instanceof CircuitTimeoutError) throw stripeError;
      // Stripe call failed — mark the FundTransfer as FAILED.
      const failureReason = (stripeError instanceof Error ? stripeError.message : "Unknown Stripe error").slice(0, 500);
      console.error("[org/fund] Stripe inbound transfer failed:", failureReason);

      try {
        await prisma.fundTransfer.update({
          where: { id: fundTransfer.id },
          data: {
            status: "FAILED",
            failureReason,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            organizationId: user.organizationId,
            action: "create",
            entityType: "fund_transfer",
            entityId: fundTransfer.id,
            newValue: {
              action: "inbound_transfer_failed",
              requestId,
              amountCents: amountInCents,
              currency: "usd",
              status: "FAILED",
            },
          },
        });
      } catch (cleanupErr) {
        console.error("[org/fund] cleanup after Stripe failure failed:", cleanupErr);
      }

      return NextResponse.json(
        { error: "Fund transfer failed. Please try again or contact support." },
        { status: 502 },
      );
    }
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_POST,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) {
      return circuitErrorResponse(error, ROUTE_POST, "POST");
    }
    console.error("POST /api/org/fund error:", error);
    return NextResponse.json(
      { error: "Failed to initiate fund transfer" },
      { status: 500 },
    );
  }
}

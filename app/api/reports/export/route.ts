// ORG-SCOPED: All queries filtered by session.user.organizationId.
// Role-gated: only admin/audit/compliance roles can export bulk reports.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  generateAuditTrailCSV,
  generateExpenseSummaryCSV,
  generateGrantComplianceCSV,
  generateLedgerCSV,
  generateTransactionHistoryCSV,
  type CsvAuditRow,
  type CsvExpenseRow,
  type CsvGrantRow,
  type CsvLedgerRow,
  type CsvTransactionRow,
} from "@/lib/services/report-csv";
import {
  generateAuditTrailPDF,
  generateExpenseSummaryPDF,
  generateGrantCompliancePDF,
  generateLedgerPDF,
  generateTransactionHistoryPDF,
} from "@/lib/services/report-pdf";

// pdfkit requires Node runtime (font file access).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set([
  "nonprofit_admin",
  "platform_admin",
  "auditor",
  "cpa",
  "compliance_officer",
]);

type ReportType =
  | "grant_compliance"
  | "expense_summary"
  | "transaction_history"
  | "audit_trail"
  | "ledger";

type ReportFormat = "pdf" | "csv";

interface ExportQuery {
  type: ReportType;
  format: ReportFormat;
  startDate: Date;
  endDate: Date;
  grantId: string | null;
}

function parseQuery(url: URL): ExportQuery | { error: string; status: number } {
  const type = url.searchParams.get("type") as ReportType | null;
  const format = (url.searchParams.get("format") || "csv") as ReportFormat;
  const grantId = url.searchParams.get("grantId");
  const startStr = url.searchParams.get("startDate");
  const endStr = url.searchParams.get("endDate");

  const validTypes: ReportType[] = [
    "grant_compliance",
    "expense_summary",
    "transaction_history",
    "audit_trail",
    "ledger",
  ];
  if (!type || !validTypes.includes(type)) {
    return { error: "Invalid or missing 'type' parameter", status: 400 };
  }
  if (format !== "pdf" && format !== "csv") {
    return { error: "Invalid 'format' — must be 'pdf' or 'csv'", status: 400 };
  }
  // Ledger export is CSV-only (for import into accounting software).
  if (type === "ledger" && format === "pdf") {
    // Allow it — we still render a PDF but note this as supported.
  }
  if (type === "grant_compliance" && !grantId) {
    return { error: "grant_compliance export requires 'grantId'", status: 400 };
  }

  // Default date range: last 90 days → today
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  const endDate = endStr ? new Date(endStr) : now;
  const startDate = startStr ? new Date(startStr) : defaultStart;

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: "Invalid date format — use ISO 8601", status: 400 };
  }
  if (startDate > endDate) {
    return { error: "startDate must be before endDate", status: 400 };
  }

  return { type, format, startDate, endDate, grantId };
}

function sanitizeForFilename(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "report";
}

function buildFilename(
  type: ReportType,
  format: ReportFormat,
  orgName: string,
  endDate: Date,
): string {
  const datePart = endDate.toISOString().slice(0, 10);
  return `${sanitizeForFilename(orgName)}-${type}-${datePart}.${format}`;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, organizationName } = session.user;
    if (!role || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!organizationId) {
      return NextResponse.json({ error: "No organization context" }, { status: 400 });
    }

    const parsed = parseQuery(new URL(request.url));
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { type, format, startDate, endDate, grantId } = parsed;

    const orgName = organizationName || "Your Organization";
    const meta = {
      orgName,
      title: reportTitle(type, grantId),
      periodStart: startDate,
      periodEnd: endDate,
    };

    // Build the payload body based on (type, format)
    let body: Buffer | string;
    let contentType: string;

    switch (type) {
      case "expense_summary": {
        const expenses = await fetchExpenses(organizationId, startDate, endDate);
        if (format === "csv") {
          body = generateExpenseSummaryCSV(expenses);
          contentType = "text/csv; charset=utf-8";
        } else {
          body = await generateExpenseSummaryPDF({ meta, expenses });
          contentType = "application/pdf";
        }
        break;
      }

      case "transaction_history": {
        const transactions = await fetchTransactions(organizationId, startDate, endDate);
        if (format === "csv") {
          body = generateTransactionHistoryCSV(transactions);
          contentType = "text/csv; charset=utf-8";
        } else {
          body = await generateTransactionHistoryPDF({ meta, transactions });
          contentType = "application/pdf";
        }
        break;
      }

      case "audit_trail": {
        const logs = await fetchAuditLogs(organizationId, startDate, endDate);
        if (format === "csv") {
          body = generateAuditTrailCSV(logs);
          contentType = "text/csv; charset=utf-8";
        } else {
          body = await generateAuditTrailPDF({ meta, logs });
          contentType = "application/pdf";
        }
        break;
      }

      case "ledger": {
        const entries = await fetchLedgerEntries(organizationId, startDate, endDate);
        if (format === "csv") {
          body = generateLedgerCSV(entries);
          contentType = "text/csv; charset=utf-8";
        } else {
          body = await generateLedgerPDF({ meta, entries });
          contentType = "application/pdf";
        }
        break;
      }

      case "grant_compliance": {
        if (!grantId) {
          return NextResponse.json({ error: "grantId required" }, { status: 400 });
        }
        const grant = await fetchGrantWithScope(grantId, organizationId);
        if (!grant) {
          return NextResponse.json({ error: "Grant not found" }, { status: 404 });
        }
        const [expenses, transactions] = await Promise.all([
          fetchExpensesForGrant(grantId, startDate, endDate),
          fetchTransactionsForGrant(grantId, startDate, endDate, organizationId),
        ]);

        if (format === "csv") {
          body = generateGrantComplianceCSV({ grant, expenses, transactions });
          contentType = "text/csv; charset=utf-8";
        } else {
          body = await generateGrantCompliancePDF({ meta, grant, expenses, transactions });
          contentType = "application/pdf";
        }
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
    }

    const filename = buildFilename(type, format, orgName, endDate);

    // Convert Node Buffer → Uint8Array for a web-standard BodyInit.
    const responseBody: BodyInit =
      typeof body === "string" ? body : new Uint8Array(body);

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[/api/reports/export] error:", err);
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function reportTitle(type: ReportType, grantId: string | null): string {
  switch (type) {
    case "grant_compliance":
      return `Grant Compliance Report${grantId ? "" : ""}`;
    case "expense_summary":
      return "Expense Summary";
    case "transaction_history":
      return "Transaction History";
    case "audit_trail":
      return "Audit Trail";
    case "ledger":
      return "Ledger Export";
  }
}

async function fetchExpenses(
  organizationId: string,
  startDate: Date,
  endDate: Date,
): Promise<CsvExpenseRow[]> {
  const rows = await prisma.expenseRequest.findMany({
    where: {
      grant: { organizationId },
      createdAt: { gte: startDate, lte: endDate },
      archivedAt: null,
    },
    select: {
      id: true,
      description: true,
      amount: true,
      status: true,
      riskClassification: true,
      createdAt: true,
      grant: { select: { name: true } },
      category: { select: { name: true } },
      requestedBy: { select: { firstName: true, lastName: true, email: true } },
      vendor: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  return rows.map(toCsvExpense);
}

async function fetchExpensesForGrant(
  grantId: string,
  startDate: Date,
  endDate: Date,
): Promise<CsvExpenseRow[]> {
  const rows = await prisma.expenseRequest.findMany({
    where: {
      grantId,
      createdAt: { gte: startDate, lte: endDate },
      archivedAt: null,
    },
    select: {
      id: true,
      description: true,
      amount: true,
      status: true,
      riskClassification: true,
      createdAt: true,
      grant: { select: { name: true } },
      category: { select: { name: true } },
      requestedBy: { select: { firstName: true, lastName: true, email: true } },
      vendor: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  return rows.map(toCsvExpense);
}

function toCsvExpense(e: {
  id: string;
  description: string;
  amount: unknown;
  status: string;
  riskClassification: string | null;
  createdAt: Date;
  grant: { name: string } | null;
  category: { name: string } | null;
  requestedBy: { firstName: string; lastName: string; email: string } | null;
  vendor: { name: string } | null;
}): CsvExpenseRow {
  return {
    id: e.id,
    description: e.description,
    amount: String(e.amount),
    status: e.status,
    riskClassification: e.riskClassification,
    createdAt: e.createdAt,
    grant: e.grant,
    category: e.category,
    requestedBy: e.requestedBy,
    vendor: e.vendor,
  };
}

async function fetchTransactions(
  organizationId: string,
  startDate: Date,
  endDate: Date,
): Promise<CsvTransactionRow[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      organizationId,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      amount: true,
      merchantName: true,
      merchantCategory: true,
      status: true,
      createdAt: true,
      grantId: true,
      card: { select: { cardLabel: true, last4: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  // Look up grant names in one batch to avoid N+1
  const grantIds = Array.from(
    new Set(rows.map((r) => r.grantId).filter((x): x is string => Boolean(x))),
  );
  const grants = grantIds.length
    ? await prisma.grant.findMany({
        where: { id: { in: grantIds }, organizationId },
        select: { id: true, name: true },
      })
    : [];
  const grantMap = new Map(grants.map((g) => [g.id, g.name]));

  return rows.map((r) => ({
    id: r.id,
    amount: String(r.amount),
    merchantName: r.merchantName,
    merchantCategory: r.merchantCategory,
    status: r.status,
    createdAt: r.createdAt,
    card: r.card,
    grant: r.grantId ? { name: grantMap.get(r.grantId) || "" } : null,
  }));
}

async function fetchTransactionsForGrant(
  grantId: string,
  startDate: Date,
  endDate: Date,
  organizationId: string,
): Promise<CsvTransactionRow[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      grantId,
      organizationId,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      amount: true,
      merchantName: true,
      merchantCategory: true,
      status: true,
      createdAt: true,
      card: { select: { cardLabel: true, last4: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });
  return rows.map((r) => ({
    id: r.id,
    amount: String(r.amount),
    merchantName: r.merchantName,
    merchantCategory: r.merchantCategory,
    status: r.status,
    createdAt: r.createdAt,
    card: r.card,
    grant: null,
  }));
}

async function fetchAuditLogs(
  organizationId: string,
  startDate: Date,
  endDate: Date,
): Promise<CsvAuditRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      userId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const userIds = Array.from(new Set(rows.map((r) => r.userId).filter((x): x is string => Boolean(x))));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => {
    const u = r.userId ? userMap.get(r.userId) : null;
    return {
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      createdAt: r.createdAt,
      user: u ? { firstName: u.firstName, lastName: u.lastName, email: u.email } : null,
    };
  });
}

async function fetchLedgerEntries(
  organizationId: string,
  startDate: Date,
  endDate: Date,
): Promise<CsvLedgerRow[]> {
  // LedgerEntry has no direct organizationId — we get there through grantId.
  // First resolve this org's grants, then scope ledger entries to that set.
  const orgGrants = await prisma.grant.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });
  if (orgGrants.length === 0) return [];
  const grantMap = new Map(orgGrants.map((g) => [g.id, g.name]));
  const grantIds = orgGrants.map((g) => g.id);

  const rows = await prisma.ledgerEntry.findMany({
    where: {
      grantId: { in: grantIds },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      description: true,
      reference: true,
      createdAt: true,
      grantId: true,
    },
    orderBy: { createdAt: "asc" },
    take: 10000,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    amount: String(r.amount),
    balanceAfter: String(r.balanceAfter),
    description: r.description,
    reference: r.reference,
    createdAt: r.createdAt,
    grant: r.grantId ? { name: grantMap.get(r.grantId) || "" } : null,
  }));
}

async function fetchGrantWithScope(
  grantId: string,
  organizationId: string,
): Promise<(CsvGrantRow & { approvedMCCs: unknown; blockedMCCs: unknown; description: string | null }) | null> {
  const g = await prisma.grant.findFirst({
    where: { id: grantId, organizationId },
    select: {
      id: true,
      name: true,
      status: true,
      description: true,
      totalAmount: true,
      spentAmount: true,
      remainingAmount: true,
      startDate: true,
      endDate: true,
      approvedMCCs: true,
      blockedMCCs: true,
      beneficiary: { select: { firstName: true, lastName: true } },
    },
  });
  if (!g) return null;
  return {
    id: g.id,
    name: g.name,
    status: g.status,
    description: g.description,
    totalAmount: String(g.totalAmount),
    spentAmount: String(g.spentAmount),
    remainingAmount: String(g.remainingAmount),
    startDate: g.startDate,
    endDate: g.endDate,
    beneficiary: g.beneficiary,
    approvedMCCs: g.approvedMCCs,
    blockedMCCs: g.blockedMCCs,
  };
}

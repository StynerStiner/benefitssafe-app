/**
 * Server-side CSV generators for BenefitsSafe exports.
 *
 * All builders produce RFC-4180 compliant CSV strings with a trailing
 * newline. Values are quoted when they contain commas, quotes, or
 * newlines, and embedded quotes are doubled.
 */

type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function generateCSV(headers: string[], rows: Cell[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(","));
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

// ═══════════════════════════════════════════════════════════
// Shared shapes (row-level — keep loose to avoid Prisma import cycles)
// ═══════════════════════════════════════════════════════════

export interface CsvExpenseRow {
  id: string;
  description: string;
  amount: string | number;
  status: string;
  riskClassification: string | null;
  createdAt: Date | string;
  grant: { name: string } | null;
  category: { name: string } | null;
  requestedBy: { firstName: string; lastName: string; email: string } | null;
  vendor: { name: string } | null;
}

export interface CsvTransactionRow {
  id: string;
  amount: string | number;
  merchantName: string;
  merchantCategory: string | null;
  status: string;
  createdAt: Date | string;
  card: { cardLabel: string | null; last4: string } | null;
  grant: { name: string } | null;
}

export interface CsvAuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: Date | string;
  user: { firstName: string; lastName: string; email: string } | null;
}

export interface CsvLedgerRow {
  id: string;
  type: string;
  amount: string | number;
  balanceAfter: string | number;
  description: string;
  reference: string | null;
  createdAt: Date | string;
  grant: { name: string } | null;
}

export interface CsvGrantRow {
  id: string;
  name: string;
  status: string;
  totalAmount: string | number;
  spentAmount: string | number;
  remainingAmount: string | number;
  startDate: Date | string;
  endDate: Date | string | null;
  beneficiary: { firstName: string; lastName: string } | null;
}

// ═══════════════════════════════════════════════════════════
// Formatters
// ═══════════════════════════════════════════════════════════

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function fmtMoney(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "0.00";
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (Number.isNaN(n)) return "0.00";
  return n.toFixed(2);
}

function fullName(p: { firstName: string; lastName: string } | null | undefined): string {
  if (!p) return "";
  return `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

// ═══════════════════════════════════════════════════════════
// Builders
// ═══════════════════════════════════════════════════════════

export function generateExpenseSummaryCSV(expenses: CsvExpenseRow[]): string {
  return generateCSV(
    [
      "Expense ID",
      "Date",
      "Description",
      "Amount (USD)",
      "Status",
      "Risk",
      "Grant",
      "Category",
      "Requested By",
      "Requester Email",
      "Vendor",
    ],
    expenses.map((e) => [
      e.id,
      fmtDate(e.createdAt),
      e.description,
      fmtMoney(e.amount),
      e.status,
      e.riskClassification || "",
      e.grant?.name || "",
      e.category?.name || "",
      fullName(e.requestedBy),
      e.requestedBy?.email || "",
      e.vendor?.name || "",
    ]),
  );
}

export function generateTransactionHistoryCSV(txns: CsvTransactionRow[]): string {
  return generateCSV(
    [
      "Transaction ID",
      "Timestamp",
      "Merchant",
      "MCC",
      "Amount (USD)",
      "Status",
      "Card",
      "Last 4",
      "Grant",
    ],
    txns.map((t) => [
      t.id,
      fmtDateTime(t.createdAt),
      t.merchantName,
      t.merchantCategory || "",
      fmtMoney(t.amount),
      t.status,
      t.card?.cardLabel || "",
      t.card?.last4 || "",
      t.grant?.name || "",
    ]),
  );
}

export function generateAuditTrailCSV(logs: CsvAuditRow[]): string {
  return generateCSV(
    ["Log ID", "Timestamp", "Action", "Entity Type", "Entity ID", "User", "User Email"],
    logs.map((l) => [
      l.id,
      fmtDateTime(l.createdAt),
      l.action,
      l.entityType,
      l.entityId,
      fullName(l.user),
      l.user?.email || "",
    ]),
  );
}

export function generateLedgerCSV(entries: CsvLedgerRow[]): string {
  return generateCSV(
    [
      "Ledger ID",
      "Timestamp",
      "Type",
      "Amount (USD)",
      "Balance After",
      "Description",
      "Reference",
      "Grant",
    ],
    entries.map((e) => [
      e.id,
      fmtDateTime(e.createdAt),
      e.type,
      fmtMoney(e.amount),
      fmtMoney(e.balanceAfter),
      e.description,
      e.reference || "",
      e.grant?.name || "",
    ]),
  );
}

export function generateGrantComplianceCSV(input: {
  grant: CsvGrantRow & { approvedMCCs?: unknown; blockedMCCs?: unknown };
  expenses: CsvExpenseRow[];
  transactions: CsvTransactionRow[];
}): string {
  const { grant, expenses, transactions } = input;
  const lines: string[] = [];

  // Section 1: Grant summary
  lines.push("GRANT SUMMARY");
  lines.push(generateCSV(
    ["Field", "Value"],
    [
      ["Grant Name", grant.name],
      ["Status", grant.status],
      ["Total Budget", fmtMoney(grant.totalAmount)],
      ["Spent", fmtMoney(grant.spentAmount)],
      ["Remaining", fmtMoney(grant.remainingAmount)],
      ["Start Date", fmtDate(grant.startDate)],
      ["End Date", fmtDate(grant.endDate)],
      ["Beneficiary", fullName(grant.beneficiary)],
      ["Approved MCCs", Array.isArray(grant.approvedMCCs) ? (grant.approvedMCCs as string[]).join("; ") : ""],
      ["Blocked MCCs", Array.isArray(grant.blockedMCCs) ? (grant.blockedMCCs as string[]).join("; ") : ""],
    ],
  ));

  // Section 2: Expenses
  lines.push("");
  lines.push("EXPENSES");
  lines.push(generateExpenseSummaryCSV(expenses));

  // Section 3: Transactions
  lines.push("");
  lines.push("TRANSACTIONS");
  lines.push(generateTransactionHistoryCSV(transactions));

  return lines.join("\r\n");
}

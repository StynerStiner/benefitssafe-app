import { auth } from "@/auth";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import EmptyState from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Compliance Dashboard | BenefitsSafe",
  description:
    "Real-time compliance overview — flagged expenses, risk classification breakdown, and recent audit activity.",
};

// Server-rendered with live org data. This replaces a WowDash podcast
// template that was rendering on the /compliance route.
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set([
  "nonprofit_admin",
  "nonprofit_staff",
  "cpa",
  "auditor",
  "attorney",
  "compliance_officer",
  "platform_admin",
]);

function riskBadgeVariant(level: string): "default" | "secondary" | "outline" {
  if (level === "BLOCKED" || level === "LIKELY_RISKY") return "outline";
  if (level === "NEEDS_REVIEW") return "secondary";
  return "default";
}

export default async function CompliancePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!ALLOWED_ROLES.has(session.user.role)) {
    redirect("/dashboard");
  }

  const { organizationId } = session.user;

  const [
    blockedCount,
    riskyCount,
    reviewCount,
    safeCount,
    pendingExpenses,
    recentAuditLogs,
    orgName,
  ] = await Promise.all([
    prisma.expenseRequest.count({
      where: { organizationId, riskClassification: "BLOCKED" },
    }),
    prisma.expenseRequest.count({
      where: { organizationId, riskClassification: "LIKELY_RISKY" },
    }),
    prisma.expenseRequest.count({
      where: { organizationId, riskClassification: "NEEDS_REVIEW" },
    }),
    prisma.expenseRequest.count({
      where: { organizationId, riskClassification: "LIKELY_SAFE" },
    }),
    prisma.expenseRequest.findMany({
      where: {
        organizationId,
        riskClassification: { in: ["NEEDS_REVIEW", "LIKELY_RISKY", "BLOCKED"] },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        riskClassification: true,
        riskNotes: true,
        createdAt: true,
        grant: { select: { name: true } },
        requestedBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.organization
      .findUnique({ where: { id: organizationId }, select: { name: true } })
      .then((o) => o?.name || "Your organization"),
  ]);

  const totalFlagged = blockedCount + riskyCount + reviewCount;
  const totalClassified = totalFlagged + safeCount;

  return (
    <>
      <DashboardBreadcrumb title="Compliance" text="Compliance" />

      <div className="rounded-xl border border-border bg-background shadow-sm p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              {orgName} — Compliance overview
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl">
              Live counts from the BenefitsSafe compliance engine. Every expense
              is classified against SSI, SSDI, Medicaid, and Medi-Cal rules
              before it can be approved. Detailed history is available in{" "}
              <Link
                href="/audit-trail"
                className="text-primary underline underline-offset-2"
              >
                Audit Trail
              </Link>{" "}
              and{" "}
              <Link
                href="/reports"
                className="text-primary underline underline-offset-2"
              >
                Reports
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        <div className="rounded-xl border border-border bg-background shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-500" aria-hidden="true" />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Blocked</p>
          </div>
          <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
            {blockedCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-500" aria-hidden="true" />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Likely risky</p>
          </div>
          <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
            {riskyCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-yellow-500" aria-hidden="true" />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Needs review</p>
          </div>
          <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
            {reviewCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-green-500" aria-hidden="true" />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Likely safe</p>
          </div>
          <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
            {safeCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-background shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-white">
            Flagged expenses
          </h3>
          {pendingExpenses.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={
                totalClassified === 0
                  ? "No expenses classified yet"
                  : "No flagged expenses"
              }
              message={
                totalClassified === 0
                  ? "Expenses submitted by beneficiaries and staff will appear here once the compliance engine evaluates them."
                  : "Every classified expense is currently in the safe tier. Nothing needs review right now."
              }
              ctaLabel="Open expense queue"
              ctaHref="/expenses"
            />
          ) : (
            <div className="space-y-3">
              {pendingExpenses.map((e) => (
                <Link
                  key={e.id}
                  href={`/expenses`}
                  className="block rounded-lg border border-border p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                        {e.description}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        {e.grant.name} — {e.requestedBy.firstName}{" "}
                        {e.requestedBy.lastName}
                      </p>
                      {e.riskNotes && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                          {e.riskNotes}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                        ${Number(e.amount).toFixed(2)}
                      </p>
                      <Badge
                        variant={riskBadgeVariant(e.riskClassification)}
                        className="mt-1"
                      >
                        {e.riskClassification}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-background shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-white">
            Recent audit activity
          </h3>
          {recentAuditLogs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No audit activity yet"
              message="Every grant, expense, card, and approval action is recorded here. Activity will appear as your team uses the platform."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentAuditLogs.map((log) => (
                <li key={log.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-900 dark:text-white">
                      <span className="font-medium">{log.action}</span>{" "}
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {log.entityType}
                      </span>
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {log.createdAt.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 pt-4 border-t border-border">
            <Link
              href="/audit-trail"
              className="text-sm text-primary hover:underline"
            >
              View full audit trail →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

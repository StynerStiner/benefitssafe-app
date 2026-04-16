import { auth } from "@/auth";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import EmptyState from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { Building2, CreditCard, DollarSign, Receipt } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Vendor Dashboard | BenefitsSafe",
  description:
    "Your BenefitsSafe vendor workspace — profile, status, and recent payments.",
};

// Server-rendered: we pull directly from Prisma for the logged-in vendor.
// Dynamic so the session cookie is always evaluated at request time.
export const dynamic = "force-dynamic";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "APPROVED" || status === "ACTIVE") return "default";
  if (status === "REJECTED" || status === "BLOCKED") return "outline";
  return "secondary";
}

export default async function VendorDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Only vendors should land here. Anyone else gets bounced to their own home.
  if (session.user.role !== "vendor") {
    redirect("/dashboard");
  }

  const vendor = await prisma.vendor.findFirst({
    where: { userId: session.user.id, organizationId: session.user.organizationId, archivedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      website: true,
      status: true,
      type: true,
      paymentMethod: true,
      taxIdCollected: true,
      form1099Required: true,
      createdAt: true,
      organization: { select: { name: true } },
    },
  });

  // A vendor user without a Vendor row is in a pending-onboarding state —
  // show a clean empty state, not a crashing dashboard.
  if (!vendor) {
    return (
      <>
        <DashboardBreadcrumb title="Vendor Dashboard" text="Vendor Dashboard" />
        <div className="rounded-xl border border-border bg-background shadow-sm p-6">
          <EmptyState
            icon={Building2}
            title="Vendor profile not set up yet"
            message="Your vendor profile is still being provisioned by the nonprofit that invited you. You will be able to see payments and transactions once your profile is approved."
            ctaLabel="Complete your profile"
            ctaHref="/profile"
          />
        </div>
      </>
    );
  }

  const [paymentAgg, recentPayments] = await Promise.all([
    prisma.transaction.aggregate({
      where: { card: { vendorId: vendor.id }, status: "completed" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.findMany({
      where: { card: { vendorId: vendor.id }, status: "completed" },
      select: {
        id: true,
        amount: true,
        merchantName: true,
        createdAt: true,
        card: { select: { cardLabel: true, last4: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalReceived = Number(paymentAgg._sum.amount ?? 0);
  const paymentCount = paymentAgg._count._all;

  return (
    <>
      <DashboardBreadcrumb title="Vendor Dashboard" text="Vendor Dashboard" />

      <div className="rounded-xl border border-border bg-background shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              {vendor.name}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {vendor.organization.name}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant={statusBadgeVariant(vendor.status)}>
                {vendor.status}
              </Badge>
              <Badge variant="outline">{vendor.type}</Badge>
              {vendor.form1099Required && (
                <Badge variant="outline">1099 required</Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Member since
            </p>
            <p className="text-sm font-medium text-neutral-900 dark:text-white">
              {vendor.createdAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <div className="rounded-xl border border-border bg-background shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Total received</p>
          </div>
          <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
            {formatCurrency(totalReceived)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Completed payments</p>
          </div>
          <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
            {paymentCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Payment method</p>
          </div>
          <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
            {vendor.paymentMethod || "Not set"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-white">
          Recent payments
        </h3>
        {recentPayments.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No payments yet"
            message="Payments from nonprofits using this vendor will appear here once transactions are completed."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Merchant</th>
                  <th className="py-2 pr-4">Card</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 pr-4 text-neutral-700 dark:text-neutral-300">
                      {p.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 pr-4 text-neutral-900 dark:text-white">
                      {p.merchantName || "—"}
                    </td>
                    <td className="py-3 pr-4 text-neutral-700 dark:text-neutral-300">
                      {p.card.cardLabel || `•••• ${p.card.last4 ?? ""}`}
                    </td>
                    <td className="py-3 pr-4 text-right font-medium text-neutral-900 dark:text-white">
                      {formatCurrency(Number(p.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

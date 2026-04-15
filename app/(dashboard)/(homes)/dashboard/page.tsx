"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import EmptyState from "@/components/shared/empty-state";
import OnboardingChecklist from "@/components/shared/onboarding-checklist";
import PageDateFilter from "@/components/shared/page-date-filter";
import { HandCoins } from "lucide-react";
import { useEffect, useState } from "react";
import BalanceStatistic from "./components/balance-statistic";
import EarningCategories from "./components/earning-categories";
import ExpenseStatisticsCard from "./components/expense-statistics-card";
import InvestmentCard from "./components/investment-card";
import MonthlyExpenseBreakdown from "./components/monthly-expense-breakdown";
import PaymentHistory from "./components/payment-history";
import QuickTransfer from "./components/quick-transfer";
import StatisticsCard from "./components/statistics-card";
import TransactionHistoryCard from "./components/transaction-history-card";

interface Grant {
    id: string;
    name: string;
    status: string;
    totalAmount: string;
    spentAmount: string;
    remainingAmount: string;
    createdAt: string;
    categories: { id: string; name: string; allocatedAmount: string; spentAmount: string }[];
    beneficiary: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface Expense {
    id: string;
    description: string;
    amount: string;
    status: string;
    expenseType: string;
    createdAt: string;
    requestedBy: { id: string; firstName: string; lastName: string } | null;
    grant: { id: string; name: string } | null;
    category: { id: string; name: string } | null;
}

interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    userId: string;
    newValue: Record<string, unknown> | null;
}

const FinancePage = () => {
    const [grants, setGrants] = useState<Grant[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    useEffect(() => {
        fetch("/api/dashboard")
            .then((r) => r.ok ? r.json() : {})
            .then((data: Record<string, unknown>) => {
                const d = data as { grants?: { items?: Grant[] }; expenses?: { recentItems?: Expense[] }; auditLog?: { recentItems?: AuditLog[] } };
                if (d.grants?.items) setGrants(d.grants.items);
                if (d.expenses?.recentItems) setExpenses(d.expenses.recentItems);
                if (d.auditLog?.recentItems) setAuditLogs(d.auditLog.recentItems);
            })
            .catch(() => {
                setError("Failed to load dashboard data. Please try refreshing the page.");
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <>
                <DashboardBreadcrumb title="Dashboard" text="Admin Overview" />
                <LoadingSkeleton />
            </>
        );
    }

    // "Nothing to show yet" state — brand-new org with no grants, no
    // expenses, no audit activity. Instead of rendering a dashboard full
    // of empty charts, surface the onboarding checklist + a prominent
    // welcome with a direct CTA to create the first grant.
    const isEmpty =
        grants.length === 0 && expenses.length === 0 && auditLogs.length === 0;

    if (isEmpty) {
        return (
            <>
                <DashboardBreadcrumb title="Dashboard" text="Admin Overview" />
                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}
                <OnboardingChecklist />
                <div className="card rounded-xl border border-border bg-background shadow-sm mt-6">
                    <EmptyState
                        icon={HandCoins}
                        title="Welcome to BenefitsSafe"
                        message="Your dashboard will light up once you've created your first grant and issued funds to beneficiaries. Start by adding a grant — you can onboard beneficiaries and issue cards from there."
                        ctaLabel="Create your first grant"
                        ctaHref="/grants"
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between">
                <DashboardBreadcrumb title="Dashboard" text="Admin Overview" />
                <PageDateFilter
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onChange={(month, year) => {
                        setSelectedMonth(month);
                        setSelectedYear(year);
                    }}
                />
            </div>

            {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            <OnboardingChecklist />

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                <StatisticsCard grants={grants} expenses={expenses} />
            </div>

            <div className="mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                    <div className="col-span-12 xl:col-span-8">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                            <div className="col-span-12">
                                <BalanceStatistic expenses={expenses} selectedMonth={selectedMonth} selectedYear={selectedYear} />
                            </div>
                            <div className="col-span-12 md:col-span-6">
                                <EarningCategories grants={grants} />
                            </div>
                            <div className="col-span-12 md:col-span-6">
                                <ExpenseStatisticsCard expenses={expenses} selectedMonth={selectedMonth} selectedYear={selectedYear} />
                            </div>
                            <div className="col-span-12 md:col-span-6">
                                <PaymentHistory expenses={expenses} />
                            </div>
                            <div className="col-span-12 md:col-span-6">
                                <MonthlyExpenseBreakdown grants={grants} />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-12 xl:col-span-4">
                        <div className="flex flex-col gap-6">
                            <QuickTransfer grants={grants} />
                            <InvestmentCard grants={grants} expenses={expenses} selectedMonth={selectedMonth} selectedYear={selectedYear} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-6 lg:block hidden">
                <TransactionHistoryCard auditLogs={auditLogs} />
            </div>
        </>
    );
};
export default FinancePage;

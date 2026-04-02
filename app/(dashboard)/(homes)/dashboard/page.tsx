"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import PageDateFilter from "@/components/shared/page-date-filter";
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
        Promise.all([
            fetch("/api/grants?limit=100").then((r) => r.ok ? r.json() : { data: [] }),
            fetch("/api/expenses?limit=100").then((r) => r.ok ? r.json() : { data: [] }),
            fetch("/api/audit-logs").then((r) => r.ok ? r.json() : []),
        ])
            .then(([gJson, eJson, a]) => {
                const g = Array.isArray(gJson) ? gJson : gJson.data;
                if (Array.isArray(g)) setGrants(g);
                const e = Array.isArray(eJson) ? eJson : eJson.data;
                if (Array.isArray(e)) setExpenses(e);
                const logs = Array.isArray(a) ? a : (a?.logs && Array.isArray(a.logs) ? a.logs : []);
                setAuditLogs(logs);
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

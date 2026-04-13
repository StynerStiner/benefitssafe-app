"use client";

import DashboardBreadcrumb from '@/components/layout/dashboard-breadcrumb';
import LoadingSkeleton from '@/components/loading-skeleton';
import EmptyState from '@/components/shared/empty-state';
import { BarChart3 } from 'lucide-react';
import { useEffect, useState } from "react";
import GrantReportsCard from './components/grant-reports-card';
import AverageDailySalesCard from './components/average-daily-sales-card';
import MonthlyCampaignStateCard from './components/monthly-campaign-state-card';
import RecentActivityCard from './components/recent-activity-card';
import RevenueStatisticCard from './components/revenue-statistic-card';
import SalesByCountriesCard from './components/sales-by-countries-card';
import SourceVisitorsCard from './components/source-visitors-card';
import SupportTrackerCard from './components/support-tracker-card';
import TransactionsCard from './components/transactions-card';
import UpgradePlanCard from './components/upgrade-plan-card';

interface Grant {
    id: string;
    name: string;
    totalAmount: string;
    spentAmount: string;
    remainingAmount: string;
    status: string;
    createdAt: string;
}

interface Expense {
    id: string;
    description: string;
    amount: string;
    status: string;
    createdAt: string;
    riskClassification: string | null;
    riskNotes: string | null;
    category: { name: string } | null;
    requestedBy: { firstName: string; lastName: string } | null;
}

interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
}

const Analytics = () => {
    const [grants, setGrants] = useState<Grant[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

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
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <>
                <DashboardBreadcrumb title="Reports" text="Financial Reports" />
                <LoadingSkeleton />
            </>
        );
    }

    const hasData = grants.length > 0 || expenses.length > 0 || auditLogs.length > 0;

    return (
        <>
            <DashboardBreadcrumb title="Reports" text="Financial Reports" />

            {!hasData && (
                <div className="mt-6 rounded-xl bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700">
                    <EmptyState
                        icon={BarChart3}
                        title="No report data yet"
                        message="Reports will populate automatically as grants are created and transactions flow through the system."
                        ctaLabel="Create a Grant"
                        ctaHref="/grants"
                    />
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                <div className="col-span-12">
                    <GrantReportsCard />
                </div>

                <div className="col-span-12 2xl:col-span-6">
                    <UpgradePlanCard grants={grants} expenses={expenses} />
                </div>

                <div className="col-span-12 2xl:col-span-6">
                    <RevenueStatisticCard grants={grants} expenses={expenses} />
                </div>

                <div className="col-span-12 xl:col-span-6 2xl:col-span-4">
                    <SupportTrackerCard expenses={expenses} />
                </div>

                <div className="col-span-12 xl:col-span-6 2xl:col-span-4">
                    <AverageDailySalesCard expenses={expenses} />
                </div>

                <div className="col-span-12 2xl:col-span-4">
                    <TransactionsCard expenses={expenses} />
                </div>

                <div className="col-span-12 2xl:col-span-6">
                    <SalesByCountriesCard grants={grants} />
                </div>

                <div className="col-span-12 2xl:col-span-6">
                    <SourceVisitorsCard expenses={expenses} />
                </div>

                <div className="col-span-12 2xl:col-span-4">
                    <MonthlyCampaignStateCard expenses={expenses} />
                </div>

                <div className="col-span-12 2xl:col-span-8">
                    <RecentActivityCard auditLogs={auditLogs} />
                </div>

            </div>
        </>
    );
};

export default Analytics;

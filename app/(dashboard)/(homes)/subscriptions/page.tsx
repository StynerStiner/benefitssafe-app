"use client";

import WorldMapChart from "@/components/charts/world-map-chart";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import EmptyState from "@/components/shared/empty-state";
import PageDateFilter from "@/components/shared/page-date-filter";
import { Repeat } from "lucide-react";
import CountryList from "@/components/shared/country-list";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import UpgradeNowCard from "../reports/components/upgrade-now-card";
import AddSubscriptionForm from "./components/add-subscription-form";
import DailyEarningsCard from "./components/daily-earnings-card";
import RecentActivityCard from "./components/recent-activity-card";
import ReferralSourcesCard from "./components/referral-sources-card";
import StatisticsCard from "./components/statistics-card";
import TransactionHistoryCard from "./components/transaction-history-card";
import UserTrafficCard from "./components/user-traffic-card";
import WidgetsCard from "./components/widgets-card";

interface Subscription {
    id: string;
    serviceName: string;
    loginEmail: string;
    monthlyCost: string;
    billingCycle: string;
    status: string;
    billingUpdateStatus: string;
    renewalDate: string | null;
    createdAt: string;
    updatedAt: string;
    vendor: { id: string; name: string; type: string; status: string } | null;
}

const SubscriptionsPage = () => {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    useEffect(() => {
        fetch("/api/subscriptions")
            .then((r) => {
                if (!r.ok) return { subscriptions: [] };
                return r.json();
            })
            .then((data) => {
                const list = Array.isArray(data) ? data : data?.subscriptions;
                if (Array.isArray(list)) setSubscriptions(list);
            })
            .catch(() => {
                setError("Failed to load subscriptions. Please try refreshing the page.");
            })
            .finally(() => setLoading(false));
    }, []);

    const handleStatusChange = (id: string, newStatus: string) => {
        setSubscriptions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, status: newStatus, updatedAt: new Date().toISOString() } : s))
        );
    };

    if (loading) {
        return (
            <>
                <DashboardBreadcrumb title="Subscriptions" text="Subscription Management" />
                <LoadingSkeleton />
            </>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between">
                <DashboardBreadcrumb title="Subscriptions" text="Subscription Management" />
                <div className="flex items-center gap-3">
                    <PageDateFilter
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        onChange={(month, year) => {
                            setSelectedMonth(month);
                            setSelectedYear(year);
                        }}
                    />
                    <AddSubscriptionForm />
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {subscriptions.length === 0 && (
                <div className="mt-6 rounded-xl bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700">
                    <EmptyState
                        icon={Repeat}
                        title="No subscriptions yet"
                        message="Manage recurring payments (SaaS, rent, utilities) that you pay on behalf of beneficiaries. Add your first subscription above."
                    />
                </div>
            )}

            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
                <div className="col-span-12 2xl:col-span-6">
                    <WidgetsCard subscriptions={subscriptions} />
                </div>

                <div className="col-span-12 2xl:col-span-6">
                    <DailyEarningsCard subscriptions={subscriptions} />
                </div>

                <div className="col-span-12 2xl:col-span-8">
                    <UserTrafficCard subscriptions={subscriptions} />
                </div>

                <div className="col-span-12 2xl:col-span-4">
                    <ReferralSourcesCard subscriptions={subscriptions} />
                </div>

                <div className="col-span-12 2xl:col-span-4">
                    <TransactionHistoryCard subscriptions={subscriptions} onStatusChange={handleStatusChange} />
                </div>

                <div className="col-span-12 2xl:col-span-8">
                    <RecentActivityCard subscriptions={subscriptions} />
                </div>

                <div className="col-span-12 2xl:col-span-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
                        <div className="col-span-12 md:col-span-4">
                            <UpgradeNowCard />
                        </div>
                        <div className="col-span-12 md:col-span-8">
                            <StatisticsCard subscriptions={subscriptions} />
                        </div>
                    </div>
                </div>
                <div className="col-span-12 2xl:col-span-6">
                    <Card className="card h-full rounded-lg border-0 !p-0 block">
                        <CardContent className="card-body p-6 h-full flex flex-col justify-between">

                            <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
                                <h3 className="font-bold text-lg mb-0">Subscriptions by Region</h3>
                                <CustomSelect
                                    placeholder="Monthly"
                                    options={["Monthly", "Weekly", "Yearly"]}
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <div className="col-span-12 lg:col-span-6">
                                    <div className="border border-neutral-300 dark:border-neutral-300/20 rounded-lg bg-neutral-50 dark:bg-neutral-600/20 h-full">
                                        <WorldMapChart mapHeight={310} />
                                    </div>
                                </div>
                                <div className="col-span-12 lg:col-span-6">
                                    <div className="border border-neutral-300 dark:border-neutral-300/20 rounded-lg bg-neutral-50 dark:bg-neutral-600/20 h-full max-h-[276px] overflow-y-auto p-6 scrollbar-thin scrollbar-invisible hover:scrollbar-visible">
                                        <CountryList />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
};
export default SubscriptionsPage;

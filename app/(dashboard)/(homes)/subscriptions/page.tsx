"use client";

import WorldMapChart from "@/components/charts/world-map-chart";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import CountryList from "@/components/shared/country-list";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import UpgradeNowCard from "../reports/components/upgrade-now-card";
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

    useEffect(() => {
        fetch("/api/subscriptions")
            .then((r) => r.ok ? r.json() : [])
            .then((data) => { if (Array.isArray(data)) setSubscriptions(data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

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
            <DashboardBreadcrumb title="Subscriptions" text="Subscription Management" />

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
                    <TransactionHistoryCard subscriptions={subscriptions} />
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
                                <h6 className="font-bold text-lg mb-0">Subscriptions by Region</h6>
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

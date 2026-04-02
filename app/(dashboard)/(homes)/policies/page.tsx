"use client";

import StatisticBarChart from "@/components/charts/statistic-bar-chart";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import { useEffect, useState } from "react";
import AvailableRoom from "./components/available-room";
import BookingCountriesStatus from "./components/booking-countries-status";
import EarningStatisticCard from "./components/earning-statistic-card";
import ExclusiveTravelPackages from "./components/exclusive-travel-packages";
import SpendOverview from "./components/spend-overview";
import StatisticsCards from "./components/statistics-cards";
import TransactionHistory from "./components/transaction-history";
import CheckInOut from "./components/check-in-out";

interface Policy {
    id: string;
    cashToRecipient: string;
    reimbursementToRecipient: string;
    rentUtilityPayments: string;
    recurringSubscriptions: string;
    maxSingleTransaction: string | null;
    allowedCategories: string[] | null;
    blockedCategories: string[] | null;
    createdAt: string;
    updatedAt: string;
}

interface Grant {
    id: string;
    name: string;
    totalAmount: string;
    spentAmount: string;
    status: string;
    createdAt: string;
}

interface Expense {
    id: string;
    status: string;
    amount: string;
}

const PoliciesPage = () => {
    const [policy, setPolicy] = useState<Policy | null>(null);
    const [grants, setGrants] = useState<Grant[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch("/api/policies").then((r) => r.ok ? r.json() : null),
            fetch("/api/grants?limit=100").then((r) => r.ok ? r.json() : { data: [] }),
            fetch("/api/expenses?limit=100").then((r) => r.ok ? r.json() : { data: [] }),
        ])
            .then(([p, gJson, eJson]) => {
                setPolicy(p);
                const g = Array.isArray(gJson) ? gJson : gJson.data;
                if (Array.isArray(g)) setGrants(g);
                const e = Array.isArray(eJson) ? eJson : eJson.data;
                if (Array.isArray(e)) setExpenses(e);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <>
                <DashboardBreadcrumb title="Disbursement Policies" text="Disbursement Policies" />
                <LoadingSkeleton />
            </>
        );
    }

    return (
        <>
            <DashboardBreadcrumb title="Disbursement Policies" text="Disbursement Policies" />

            <div className="mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">

                    <div className="col-span-12 md:col-span-6 2xl:col-span-4">
                        <StatisticsCards policy={policy} />
                    </div>

                    <div className="col-span-12 md:col-span-6 2xl:col-span-4">
                        <AvailableRoom policy={policy} />
                    </div>

                    <div className="col-span-12 2xl:col-span-4">
                        <div className="shadow-7 p-5 rounded-xl bg-white dark:bg-[#273142] h-full">
                            <div className="flex items-center flex-wrap gap-2 justify-between">
                                <h6 className="mb-0 font-bold text-lg">Policy Overview</h6>
                            </div>
                            <div className="relative text-style label-bold">
                                <StatisticBarChart />
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-6 xl:col-span-8">
                    <div className="flex flex-col gap-6">
                        <ExclusiveTravelPackages grants={grants} />
                        <EarningStatisticCard grants={grants} />
                        <TransactionHistory grants={grants} />
                    </div>
                </div>
                <div className="col-span-12 md:col-span-6 xl:col-span-4">
                    <div className="flex flex-col gap-6">
                        <BookingCountriesStatus policy={policy} />
                        <CheckInOut expenses={expenses} />
                        <SpendOverview policy={policy} />
                    </div>
                </div>
            </div>

        </>
    );
};
export default PoliciesPage;

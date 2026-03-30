// @ts-nocheck
export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import React from "react";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import DefaultCardComponent from "@/app/(dashboard)/components/default-card-component";
import StatCard from "@/app/(dashboard)/(homes)/my-dashboard/components/stat-card";
import StatsCard from "@/app/(dashboard)/(homes)/beneficiaries/components/stats-card";
import StatsCardTwo from '@/app/(dashboard)/(homes)/expenses/component/stats-card';
import StatsCardThree from '@/app/(dashboard)/(homes)/ledger/components/stats-card';
import SalesStaticCard from "@/app/(dashboard)/(homes)/my-dashboard/components/sales-static-card";
import TopCountriesCard from "@/app/(dashboard)/(homes)/my-dashboard/components/top-countries-card";
import ClientPaymentStatusCard from "@/app/(dashboard)/(homes)/beneficiaries/components/client-payment-status-card";
import EarningStatisticsCard from "@/app/(dashboard)/(homes)/beneficiaries/components/earning-statistics-card";
import UserOverviewCard from "@/app/(dashboard)/(homes)/my-dashboard/components/user-overview-card";
import StaticCard from "@/app/(dashboard)/(homes)/vendor-dashboard/components/static-card";
import DailySalesCard from "@/app/(dashboard)/(homes)/expenses/component/daily-sales-card";

const metadata: Metadata = {
    title: "Widgets & Dashboard Components | BenefitsSafe Admin Dashboard",
    description:
        "Explore customizable widgets and dashboard components to display key information in the BenefitsSafe Admin Dashboard built with Next.js and Tailwind CSS.",
};

const LineChartPage = () => {
    return (
        <>
            <DashboardBreadcrumb title="Widgets" text="Widgets" />

            <div className="">
                <DefaultCardComponent title="Metrics">
                    <div className=" flex flex-col gap-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-6">
                            <StatCard />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-6">
                            <StatsCard beneficiaries={[]} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-neutral-200 dark:border-neutral-600">
                            <StatsCardTwo />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-6">
                            <StatsCardThree />
                        </div>
                    </div>
                </DefaultCardComponent>


                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
                    <div className="col-span-12 xl:col-span-12 2xl:col-span-6">
                        <SalesStaticCard />
                    </div>
                    <div className="col-span-12 2xl:col-span-6">
                        <TopCountriesCard />
                    </div>
                    <div className="col-span-12 xl:col-span-6 2xl:col-span-4">
                        <ClientPaymentStatusCard />
                    </div>
                    <div className="col-span-12 xl:col-span-6 2xl:col-span-8">
                        <EarningStatisticsCard beneficiaries={[]} />
                    </div>
                    <div className="col-span-12 xl:col-span-6 2xl:col-span-4">
                        <UserOverviewCard />
                    </div>
                    <div className="col-span-12 xl:col-span-6 2xl:col-span-4">
                        <DailySalesCard />
                    </div>
                    <div className="col-span-12 xl:col-span-6 2xl:col-span-4">
                        <StaticCard />
                    </div>
                </div>
            </div>
        </>
    );
};
export default LineChartPage;

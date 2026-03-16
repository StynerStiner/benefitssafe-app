import DefaultCardComponent from "@/app/(dashboard)/components/default-card-component";
import ColumnGroupBarChart from "@/components/charts/column-group-bar-chart";
import GenerateContentChart from "@/components/charts/generate-content-chart";
import GroupColumnChart from "@/components/charts/group-column-chart";
import UpdownBarChart from "@/components/charts/updown-bar-chart";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

const metadata: Metadata = {
    title: "Column Charts & Data Visualization | BenefitsSafe Admin Dashboard",
    description:
        "Explore various interactive chart components for analytics and data visualization in the BenefitsSafe Admin Dashboard template built with Next.js and Tailwind CSS.",
};

const ColumnChartPage = () => {
    return (
        <>
            <DashboardBreadcrumb title="Column Chart" text="Column Chart" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DefaultCardComponent title="Column Charts">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <GenerateContentChart />
                    </Suspense>
                </DefaultCardComponent>
                <DefaultCardComponent title="Column Charts">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <ColumnGroupBarChart />
                    </Suspense>
                </DefaultCardComponent>
                <DefaultCardComponent title="Group Columns">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <GroupColumnChart />
                    </Suspense>
                </DefaultCardComponent>
                <DefaultCardComponent title="Simple Column">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <UpdownBarChart upBarColor={`487FFF`} downBarColor={`EF4A00`} chartHeight={310} />
                    </Suspense>
                </DefaultCardComponent>
            </div>
        </>
    );
};
export default ColumnChartPage;

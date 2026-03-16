import type { Metadata } from "next";
import React from "react";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import DefaultCardComponent from "@/app/(dashboard)/components/default-card-component";
import LineChart from "@/components/charts/line-chart";
import ZoomableChart from "@/components/charts/zoomable-chart";
import LineChartLabel from "@/components/charts/line-chart-label";
import LineChartAnimation from "@/components/charts/line-chart-animation";
import SteplineChart from "@/components/charts/stepline-chart";
import GradientChart from "@/components/charts/gradient-chart";
import { Suspense } from "react";
import LoadingSkeleton from "@/components/loading-skeleton";

const metadata: Metadata = {
    title: "Line Charts & Data Visualization | BenefitsSafe Admin Dashboard",
    description:
        "Explore various interactive chart components for analytics and data visualization in the BenefitsSafe Admin Dashboard template built with Next.js and Tailwind CSS.",
};


const LineChartPage = () => {
    return (
        <>
            <DashboardBreadcrumb title="Line Chart" text="Line Chart" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DefaultCardComponent title="Default Line Chart">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <LineChart />
                    </Suspense>
                </DefaultCardComponent>
                <DefaultCardComponent title="Zoomable Chart">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <ZoomableChart />
                    </Suspense>
                </DefaultCardComponent>
                <DefaultCardComponent title="Line Chart with Data Labels">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <LineChartLabel />
                    </Suspense>
                </DefaultCardComponent>
                <DefaultCardComponent title="Line Chart Animation">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <LineChartAnimation />
                    </Suspense>
                </DefaultCardComponent>
                <DefaultCardComponent title="Stepline Charts">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <SteplineChart />
                    </Suspense>
                </DefaultCardComponent>
                <DefaultCardComponent title="Gradient Charts">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <GradientChart />
                    </Suspense>
                </DefaultCardComponent>
            </div>
        </>
    );
};
export default LineChartPage;

import GenerateContentCard from "@/app/(dashboard)/(homes)/my-dashboard/components/generate-content-card";
import SalesStaticCard from "@/app/(dashboard)/(homes)/my-dashboard/components/sales-static-card";
import StatCard from "@/app/(dashboard)/(homes)/my-dashboard/components/stat-card";
import TabsWithTableCard from "@/app/(dashboard)/(homes)/my-dashboard/components/tabs-with-table-card";
import TopCountriesCard from "@/app/(dashboard)/(homes)/my-dashboard/components/top-countries-card";
import TopPerformerCard from "@/app/(dashboard)/(homes)/my-dashboard/components/top-performer-card";
import TotalSubscriberCard from "@/app/(dashboard)/(homes)/my-dashboard/components/total-subscriber-card";
import UserOverviewCard from "@/app/(dashboard)/(homes)/my-dashboard/components/user-overview-card";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

const metadata: Metadata = {
  title: "AI Dashboard | WowDash Admin Panel",
  description:
    "Explore AI analytics, monitor model performance, and track intelligent automation workflows in the AI Dashboard of WowDash Admin Template.",
};


export default async function DashboardPage() {
  return (
    <>
      <DashboardBreadcrumb title="My Dashboard" text="My Dashboard" />

      <Suspense fallback={<LoadingSkeleton />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-6">
          <StatCard />
        </div>
      </Suspense>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
        <div className="xl:col-span-12 2xl:col-span-6">
          <Suspense fallback={<LoadingSkeleton />}>
            <SalesStaticCard />
          </Suspense>
        </div>

        <div className="xl:col-span-6 2xl:col-span-3">
          <Suspense fallback={<LoadingSkeleton />}>
            <TotalSubscriberCard />
          </Suspense>
        </div>

        <div className="xl:col-span-6 2xl:col-span-3">
          <Suspense fallback={<LoadingSkeleton />}>
            <UserOverviewCard />
          </Suspense>
        </div>

        <div className="xl:col-span-12 2xl:col-span-9">
          <Suspense fallback={<LoadingSkeleton />}>
            <TabsWithTableCard />
          </Suspense>
        </div>

        <div className="xl:col-span-12 2xl:col-span-3">
          <Suspense fallback={<LoadingSkeleton />}>
            <TopPerformerCard />
          </Suspense>
        </div>

        <div className="xl:col-span-12 2xl:col-span-6">
          <Suspense fallback={<LoadingSkeleton />}>
            <TopCountriesCard />
          </Suspense>
        </div>

        <div className="xl:col-span-12 2xl:col-span-6">
          <Suspense fallback={<LoadingSkeleton />}>
            <GenerateContentCard />
          </Suspense>
        </div>
      </div>
    </>
  );
}

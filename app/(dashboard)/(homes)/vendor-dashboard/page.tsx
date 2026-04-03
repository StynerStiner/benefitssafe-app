import LatestInvestmentsCard from "@/app/(dashboard)/(homes)/vendor-dashboard/components/latest-investments-card";
import MostLocationCard from "@/app/(dashboard)/(homes)/vendor-dashboard/components/most-location-card";
import MyPortfolioCard from "@/app/(dashboard)/(homes)/vendor-dashboard/components/my-portfolio-card";
import NoticeBoardCard from "@/app/(dashboard)/(homes)/vendor-dashboard/components/notice-board-card";
import ProjectStatusCard from "@/app/(dashboard)/(homes)/vendor-dashboard/components/project-status-card";
import RevenueStatisticsCard from "@/app/(dashboard)/(homes)/vendor-dashboard/components/revenue-statistics-card";
import StaticCard from "@/app/(dashboard)/(homes)/vendor-dashboard/components/static-card";
import StatsCard from "@/app/(dashboard)/(homes)/vendor-dashboard/components/stats-card";
import TotalTransactionsCard from "@/app/(dashboard)/(homes)/vendor-dashboard/components/total-transactions-card";
import VendorPaymentHistoryCard from "@/app/(dashboard)/(homes)/vendor-dashboard/components/vendor-payment-history-card";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

const metadata: Metadata = {
  title: "Vendor Dashboard | BenefitsSafe",
  description:
    "Track vendor performance, invoices, and payments in BenefitsSafe.",
};

const InvestmentPage = () => {
  return (
    <>
      <DashboardBreadcrumb title="Vendor Dashboard" text="Vendor Dashboard" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4 gap-6">
        <Suspense fallback={<LoadingSkeleton />}>
          <StatsCard />
        </Suspense>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        <div className="col-span-12 2xl:col-span-8">
          <Suspense fallback={<LoadingSkeleton />}><RevenueStatisticsCard /></Suspense>
        </div>
        <div className="col-span-12 lg:col-span-6 2xl:col-span-4">
          <Suspense fallback={<LoadingSkeleton />}><StaticCard /></Suspense>
        </div>
        <div className="col-span-12 lg:col-span-6 2xl:col-span-3">
          <Suspense fallback={<LoadingSkeleton />}><MostLocationCard /></Suspense>
        </div>
        <div className="col-span-12 lg:col-span-6 2xl:col-span-3">
          <Suspense fallback={<LoadingSkeleton />}><MyPortfolioCard /></Suspense>
        </div>
        <div className="col-span-12 lg:col-span-6 2xl:col-span-6">
          <Suspense fallback={<LoadingSkeleton />}><LatestInvestmentsCard /></Suspense>
        </div>
        <div className="col-span-12 lg:col-span-6 2xl:col-span-4">
          <Suspense fallback={<LoadingSkeleton />}><NoticeBoardCard /></Suspense>
        </div>
        <div className="col-span-12 lg:col-span-6 2xl:col-span-4">
          <Suspense fallback={<LoadingSkeleton />}><TotalTransactionsCard /></Suspense>
        </div>
        <div className="col-span-12 2xl:col-span-4">
          <Suspense fallback={<LoadingSkeleton />}><ProjectStatusCard /></Suspense>
        </div>
        <div className="col-span-12 2xl:col-span-8">
          <Suspense fallback={<LoadingSkeleton />}><VendorPaymentHistoryCard /></Suspense>
        </div>
      </div>
    </>
  );
};
export default InvestmentPage;

"use client";

import CustomersStatisticsCard from '@/app/(dashboard)/(homes)/expenses/component/customers-statistics-card';
import DailySalesCard from '@/app/(dashboard)/(homes)/expenses/component/daily-sales-card';
import DistributionMapsCard from '@/app/(dashboard)/(homes)/expenses/component/distribution-maps-card';
import RecentOrdersCard from '@/app/(dashboard)/(homes)/expenses/component/recent-orders-card';
import RevenueReportCard from '@/app/(dashboard)/(homes)/expenses/component/revenue-report-card';
import StockReportCard from '@/app/(dashboard)/(homes)/expenses/component/stock-report-card';
import TopCustomersCard from '@/app/(dashboard)/(homes)/expenses/component/top-customers-card';
import TopSellingProductCard from '@/app/(dashboard)/(homes)/expenses/component/top-selling-product-card';
import TransactionsCard from '@/app/(dashboard)/(homes)/expenses/component/transactions-card';
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import { useEffect, useState } from "react";

interface Expense {
  id: string;
  description: string;
  amount: string;
  status: string;
  expenseType: string;
  frequency: string;
  createdAt: string;
  vendorName: string | null;
  riskClassification: string | null;
  riskNotes: string | null;
  requestedBy: { id: string; firstName: string; lastName: string; email: string } | null;
  grant: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}

const EcommercePage = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/expenses")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (Array.isArray(data)) setExpenses(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <DashboardBreadcrumb title="Expenses" text="Expense Management" />
        <LoadingSkeleton />
      </>
    );
  }

  return (
    <>
      <DashboardBreadcrumb title="Expenses" text="Expense Management" />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        <div className="md:col-span-12 2xl:col-span-9">
          <RevenueReportCard expenses={expenses} />
        </div>

        <div className="md:col-span-12 lg:col-span-6 2xl:col-span-3">
          <CustomersStatisticsCard expenses={expenses} />
        </div>

        <div className="md:col-span-12 lg:col-span-6 2xl:col-span-9">
          <RecentOrdersCard expenses={expenses} />
        </div>

        <div className="md:col-span-12 lg:col-span-6 2xl:col-span-3">
          <TransactionsCard expenses={expenses} />
        </div>

        <div className="md:col-span-12 lg:col-span-6 2xl:col-span-4">
          <DailySalesCard expenses={expenses} />
        </div>

        <div className="md:col-span-12 lg:col-span-6 2xl:col-span-4">
          <DistributionMapsCard expenses={expenses} />
        </div>

        <div className="md:col-span-12 lg:col-span-6 2xl:col-span-4">
          <TopCustomersCard expenses={expenses} />
        </div>

        <div className="md:col-span-12 2xl:col-span-6">
          <TopSellingProductCard expenses={expenses} />
        </div>

        <div className="md:col-span-12 2xl:col-span-6">
          <StockReportCard expenses={expenses} />
        </div>

      </div>
    </>
  );
};
export default EcommercePage;

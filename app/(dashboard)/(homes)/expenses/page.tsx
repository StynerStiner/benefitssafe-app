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
import AddExpenseForm from "./component/add-expense-form";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import EmptyState from "@/components/shared/empty-state";
import PageDateFilter from "@/components/shared/page-date-filter";
import { Receipt } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const fetchExpenses = () => {
    fetch("/api/expenses?limit=100")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => {
        const items = Array.isArray(json) ? json : json.data;
        if (Array.isArray(items)) setExpenses(items);
      })
      .catch(() => {
        setError("Failed to load expenses. Please try refreshing the page.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchExpenses();
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
      <div className="flex items-center justify-between">
        <DashboardBreadcrumb title="Expenses" text="Expense Management" />
        <div className="flex items-center gap-3">
          <PageDateFilter
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onChange={(month, year) => {
              setSelectedMonth(month);
              setSelectedYear(year);
            }}
          />
          <AddExpenseForm />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {expenses.length === 0 && (
        <div className="mt-6 rounded-xl bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700">
          <EmptyState
            icon={Receipt}
            title="No expenses yet"
            message="Expenses will appear here when beneficiaries submit spending requests, or when you record payments against a grant."
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        <div className="md:col-span-12 2xl:col-span-9">
          <RevenueReportCard expenses={expenses} selectedMonth={selectedMonth} selectedYear={selectedYear} />
        </div>

        <div className="md:col-span-12 lg:col-span-6 2xl:col-span-3">
          <CustomersStatisticsCard expenses={expenses} selectedMonth={selectedMonth} selectedYear={selectedYear} />
        </div>

        <div className="md:col-span-12 lg:col-span-6 2xl:col-span-9">
          <RecentOrdersCard expenses={expenses} onRefresh={fetchExpenses} />
        </div>

        <div className="md:col-span-12 lg:col-span-6 2xl:col-span-3">
          <TransactionsCard expenses={expenses} selectedMonth={selectedMonth} selectedYear={selectedYear} />
        </div>

        <div className="md:col-span-12 lg:col-span-6 2xl:col-span-4">
          <DailySalesCard expenses={expenses} />
        </div>

        <div className="md:col-span-12 lg:col-span-6 2xl:col-span-4">
          <DistributionMapsCard expenses={expenses} selectedMonth={selectedMonth} selectedYear={selectedYear} />
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

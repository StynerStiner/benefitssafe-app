"use client";

import CampaignCard from '@/app/(dashboard)/(homes)/beneficiaries/components/campaign-card';
import ClientPaymentStatusCard from '@/app/(dashboard)/(homes)/beneficiaries/components/client-payment-status-card';
import CountriesStatusCard from '@/app/(dashboard)/(homes)/beneficiaries/components/countries-status-card';
import CustomerOverviewCard from '@/app/(dashboard)/(homes)/beneficiaries/components/customer-overview-card';
import EarningStatisticsCard from '@/app/(dashboard)/(homes)/beneficiaries/components/earning-statistics-card';
import LastTransactionCard from '@/app/(dashboard)/(homes)/beneficiaries/components/last-transaction-card';
import RevenueGrowthCard from '@/app/(dashboard)/(homes)/beneficiaries/components/revenue-growth-card';
import StatsCard from '@/app/(dashboard)/(homes)/beneficiaries/components/stats-card';
import TodoListRecentCard from '@/app/(dashboard)/(homes)/beneficiaries/components/todo-list-recent-card';
import TopPerformerCard from '@/app/(dashboard)/(homes)/beneficiaries/components/top-performer-card';
import AddBeneficiaryForm from '@/app/(dashboard)/(homes)/beneficiaries/components/add-beneficiary-form';
import DashboardBreadcrumb from '@/components/layout/dashboard-breadcrumb';
import LoadingSkeleton from '@/components/loading-skeleton';
import PageDateFilter from '@/components/shared/page-date-filter';
import { useCallback, useEffect, useState } from 'react';

interface Beneficiary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  benefitPrograms: Record<string, boolean> | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { grantsAsBeneficiary?: number; expenseRequests?: number };
}

const CrmPage = () => {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const fetchBeneficiaries = useCallback(() => {
    fetch("/api/beneficiaries?limit=100&includeInactive=true")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => {
        const items = Array.isArray(json) ? json : json.data;
        if (Array.isArray(items)) setBeneficiaries(items);
      })
      .catch(() => {
        setError("Failed to load beneficiaries. Please try refreshing the page.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchBeneficiaries();
  }, [fetchBeneficiaries]);

  const handleRefresh = useCallback(() => {
    fetchBeneficiaries();
  }, [fetchBeneficiaries]);

  if (loading) {
    return (
      <>
        <DashboardBreadcrumb title="Beneficiaries" text="Beneficiary Management" />
        <LoadingSkeleton />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <DashboardBreadcrumb title="Beneficiaries" text="Beneficiary Management" />
        <PageDateFilter
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onChange={(month, year) => {
            setSelectedMonth(month);
            setSelectedYear(year);
          }}
        />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex justify-end mt-4">
        <AddBeneficiaryForm onSuccess={handleRefresh} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">

        <div className="lg:col-span-12 2xl:col-span-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <StatsCard beneficiaries={beneficiaries} />
          </div>
        </div>

        <div className="lg:col-span-12 2xl:col-span-4">
          <RevenueGrowthCard beneficiaries={beneficiaries} />
        </div>

        <div className="lg:col-span-12 2xl:col-span-8">
          <EarningStatisticsCard beneficiaries={beneficiaries} selectedMonth={selectedMonth} selectedYear={selectedYear} />
        </div>

        <div className="lg:col-span-12 2xl:col-span-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 2xl:col-span-12 col-xxl-12 col-sm-6">
              <CampaignCard beneficiaries={beneficiaries} selectedMonth={selectedMonth} selectedYear={selectedYear} />
            </div>
            <div className="lg:col-span-6 2xl:col-span-12 col-xxl-12 col-sm-6">
              <CustomerOverviewCard beneficiaries={beneficiaries} selectedMonth={selectedMonth} selectedYear={selectedYear} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 2xl:col-span-4">
          <ClientPaymentStatusCard beneficiaries={beneficiaries} />
        </div>

        <div className="lg:col-span-6 2xl:col-span-4">
          <CountriesStatusCard beneficiaries={beneficiaries} selectedMonth={selectedMonth} selectedYear={selectedYear} />
        </div>

        <div className="lg:col-span-12 2xl:col-span-4">
          <TopPerformerCard beneficiaries={beneficiaries} onRefresh={handleRefresh} />
        </div>

        <div className="lg:col-span-12 2xl:col-span-6">
          <TodoListRecentCard beneficiaries={beneficiaries} onRefresh={handleRefresh} />
        </div>

        <div className="lg:col-span-12 2xl:col-span-6">
          <LastTransactionCard beneficiaries={beneficiaries} />
        </div>

      </div>
    </>
  );
};

export default CrmPage;

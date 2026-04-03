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
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  onboardingStatus?: "active" | "pending_password" | "pending_invite";
  _count?: { grantsAsBeneficiary?: number; expenseRequests?: number };
}

const CrmPage = () => {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "inactive">("all");

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

  const filteredBeneficiaries = useMemo(() => {
    let result = beneficiaries;

    // Status filter
    if (statusFilter === "active") {
      result = result.filter(b => b.isActive && b.onboardingStatus === "active");
    } else if (statusFilter === "pending") {
      result = result.filter(b => b.onboardingStatus === "pending_password" || b.onboardingStatus === "pending_invite");
    } else if (statusFilter === "inactive") {
      result = result.filter(b => !b.isActive);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(b =>
        `${b.firstName} ${b.lastName}`.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        (b.phone && b.phone.includes(q))
      );
    }

    return result;
  }, [beneficiaries, searchQuery, statusFilter]);

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

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[280px] sm:w-[320px] h-10"
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
            {(["all", "active", "pending", "inactive"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === s
                    ? "bg-primary text-white shadow-sm"
                    : "text-neutral-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-slate-600"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                {s === "all" && ` (${beneficiaries.length})`}
                {s === "active" && ` (${beneficiaries.filter(b => b.isActive && b.onboardingStatus === "active").length})`}
                {s === "pending" && ` (${beneficiaries.filter(b => b.onboardingStatus === "pending_password" || b.onboardingStatus === "pending_invite").length})`}
                {s === "inactive" && ` (${beneficiaries.filter(b => !b.isActive).length})`}
              </button>
            ))}
          </div>
        </div>
        <AddBeneficiaryForm onSuccess={handleRefresh} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">

        <div className="lg:col-span-12 2xl:col-span-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <StatsCard beneficiaries={filteredBeneficiaries} />
          </div>
        </div>

        <div className="lg:col-span-12 2xl:col-span-4">
          <RevenueGrowthCard beneficiaries={filteredBeneficiaries} />
        </div>

        <div className="lg:col-span-12 2xl:col-span-8">
          <EarningStatisticsCard beneficiaries={filteredBeneficiaries} selectedMonth={selectedMonth} selectedYear={selectedYear} />
        </div>

        <div className="lg:col-span-12 2xl:col-span-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 2xl:col-span-12 col-xxl-12 col-sm-6">
              <CampaignCard beneficiaries={filteredBeneficiaries} selectedMonth={selectedMonth} selectedYear={selectedYear} />
            </div>
            <div className="lg:col-span-6 2xl:col-span-12 col-xxl-12 col-sm-6">
              <CustomerOverviewCard beneficiaries={filteredBeneficiaries} selectedMonth={selectedMonth} selectedYear={selectedYear} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 2xl:col-span-4">
          <ClientPaymentStatusCard beneficiaries={filteredBeneficiaries} />
        </div>

        <div className="lg:col-span-6 2xl:col-span-4">
          <CountriesStatusCard beneficiaries={filteredBeneficiaries} selectedMonth={selectedMonth} selectedYear={selectedYear} />
        </div>

        <div className="lg:col-span-12 2xl:col-span-4">
          <TopPerformerCard beneficiaries={filteredBeneficiaries} onRefresh={handleRefresh} />
        </div>

        <div className="lg:col-span-12 2xl:col-span-6">
          <TodoListRecentCard beneficiaries={filteredBeneficiaries} onRefresh={handleRefresh} />
        </div>

        <div className="lg:col-span-12 2xl:col-span-6">
          <LastTransactionCard beneficiaries={filteredBeneficiaries} />
        </div>

      </div>
    </>
  );
};

export default CrmPage;

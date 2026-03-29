"use client";

import CoinAnalyticsCard from "@/app/(dashboard)/(homes)/ledger/components/coin-analytics-card";
import MarketInfoCard from "@/app/(dashboard)/(homes)/ledger/components/market-info-card";
import MasterCard from "@/app/(dashboard)/(homes)/ledger/components/master-card";
import MyOrderCard from "@/app/(dashboard)/(homes)/ledger/components/my-order-card";
import RecentTransactionCard from "@/app/(dashboard)/(homes)/ledger/components/recent-transaction-card";
import StatsCard from "@/app/(dashboard)/(homes)/ledger/components/stats-card";
import TotalBalanceCard from "@/app/(dashboard)/(homes)/ledger/components/total-balance-card";
import UsersActivateCard from "@/app/(dashboard)/(homes)/ledger/components/users-activate-card";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import { useEffect, useState } from "react";

interface Grant {
  id: string;
  name: string;
  totalAmount: string;
  spentAmount: string;
  remainingAmount: string;
}

interface LedgerEntry {
  id: string;
  grantId: string;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string;
  reference: string | null;
  createdAt: string;
}

interface Transaction {
  id: string;
  amount: string;
  merchantName: string;
  merchantCategory: string | null;
  createdAt: string;
}

const LedgerPage = () => {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/grants?limit=100").then((r) => r.ok ? r.json() : { data: [] }),
      fetch("/api/ledger?limit=100").then((r) => r.ok ? r.json() : { ledgerEntries: [], transactions: [] }),
    ])
      .then(([gJson, ledger]) => {
        const gItems = Array.isArray(gJson) ? gJson : gJson.data;
        if (Array.isArray(gItems)) setGrants(gItems);
        if (Array.isArray(ledger.ledgerEntries)) setLedgerEntries(ledger.ledgerEntries);
        if (Array.isArray(ledger.transactions)) setTransactions(ledger.transactions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <DashboardBreadcrumb title="Ledger" text="Restricted Fund Ledger" />
        <LoadingSkeleton />
      </>
    );
  }

  return (
    <>
      <DashboardBreadcrumb title="Ledger" text="Restricted Fund Ledger" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-5 gap-6">
        <StatsCard grants={grants} ledgerEntries={ledgerEntries} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
        <div className="xl:col-span-12 2xl:col-span-8">
          <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
            <div className="col-span-12">
              <CoinAnalyticsCard grants={grants} />
            </div>

            <div className="col-span-12 2xl:col-span-6">
              <MarketInfoCard ledgerEntries={ledgerEntries} />
            </div>

            <div className="col-span-12 2xl:col-span-6">
              <MyOrderCard transactions={transactions} />
            </div>

            <div className="col-span-12">
              <RecentTransactionCard ledgerEntries={ledgerEntries} />
            </div>
          </div>
        </div>

        <div className="xl:col-span-12 2xl:col-span-4">
          <div className="flex flex-col gap-6 h-full">
            <MasterCard />
            <TotalBalanceCard grants={grants} />
            <div className="flex-1">
              <UsersActivateCard grants={grants} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LedgerPage;

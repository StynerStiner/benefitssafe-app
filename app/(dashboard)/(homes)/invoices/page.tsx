"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import { useEffect, useState } from "react";
import CustomersStatisticsCard from "../expenses/component/customers-statistics-card";
import DailySalesCard from "../expenses/component/daily-sales-card";
import DistributionMapsCard from "../expenses/component/distribution-maps-card";
import StockReportCard from "../expenses/component/stock-report-card";
import TopCustomersCard from "../expenses/component/top-customers-card";
import TopSellingProductCard from "../expenses/component/top-selling-product-card";
import TransactionsCard from "../expenses/component/transactions-card";
import RecentOrderCard from "./components/recent-order-card";
import SalesFigureCard from "./components/sales-figure-card";
import SalesWidgetsCard from "./components/sales-widgets-card";

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

const InvoicesPage = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/expenses?limit=100")
            .then((r) => r.ok ? r.json() : { data: [] })
            .then((json) => {
                const items = Array.isArray(json) ? json : json.data;
                if (Array.isArray(items)) setExpenses(items);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <>
                <DashboardBreadcrumb title="Invoices" text="Invoices & Payments" />
                <LoadingSkeleton />
            </>
        );
    }

    return (
        <>
            <DashboardBreadcrumb title="Invoices" text="Invoices & Payments" />

            <div className="">
                <SalesWidgetsCard expenses={expenses} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">

                <div className="col-span-12 2xl:col-span-4 lg:col-span-6">
                    <TransactionsCard expenses={expenses} />
                </div>

                <div className="col-span-12 2xl:col-span-8 lg:col-span-6">
                    <SalesFigureCard expenses={expenses} />
                </div>

                <div className="col-span-12 2xl:col-span-8">
                    <RecentOrderCard expenses={expenses} />
                </div>

                <div className="col-span-12 2xl:col-span-4 lg:col-span-6">
                    <DailySalesCard expenses={expenses} />
                </div>

                <div className="col-span-12 2xl:col-span-4 lg:col-span-6">
                    <CustomersStatisticsCard expenses={expenses} />
                </div>
                <div className="col-span-12 2xl:col-span-4 lg:col-span-6">
                    <DistributionMapsCard expenses={expenses} />
                </div>
                <div className="col-span-12 2xl:col-span-4 lg:col-span-6">
                    <TopCustomersCard expenses={expenses} />
                </div>
                <div className="col-span-12 2xl:col-span-8 sm:col-span-6">
                    <TopSellingProductCard expenses={expenses} />
                </div>
                <div className="col-span-12 2xl:col-span-4 sm:col-span-6">
                    <StockReportCard expenses={expenses} />
                </div>
            </div>
        </>
    );
};
export default InvoicesPage;
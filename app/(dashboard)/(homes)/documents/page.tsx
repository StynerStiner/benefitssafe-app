"use client";

import DashboardBreadcrumb from '@/components/layout/dashboard-breadcrumb';
import LoadingSkeleton from '@/components/loading-skeleton';
import EmptyState from '@/components/shared/empty-state';
import { FileText } from 'lucide-react';
import { useEffect, useState } from "react";
import IncomeExpenseCard from './components/income-expense-card';
import OverallReportCard from './components/overall-report-card';
import PurchaseSalesCard from './components/purchase-sales-card';
import RecentTransactionsCard from './components/recent-transactions-card';
import StateCards from './components/state-cards';
import TopCustomerCard from './components/top-customer-card';
import TopSuppliersCard from './components/top-suppliers-card';
import UsersCard from './components/users-card';

interface Document {
    id: string;
    entityType: string;
    entityId: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    uploadedById: string;
    organizationId: string;
    createdAt: string;
}

const DocumentsPage = () => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/documents")
            .then((r) => r.ok ? r.json() : { documents: [] })
            .then((data) => {
                if (Array.isArray(data)) setDocuments(data);
                else if (data?.documents && Array.isArray(data.documents)) setDocuments(data.documents);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <>
                <DashboardBreadcrumb title="Documents" text="Document Management" />
                <LoadingSkeleton />
            </>
        );
    }

    return (
        <>
            <DashboardBreadcrumb title="Documents" text="Document Management" />

            {documents.length === 0 && (
                <div className="mt-6 rounded-xl bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700">
                    <EmptyState
                        icon={FileText}
                        title="No documents yet"
                        message="Upload grant-related documents, receipts, and compliance records here. Documents attached to expenses and grants will also appear automatically."
                    />
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                <div className="col-span-12">
                    <StateCards documents={documents} />
                </div>

                <div className="col-span-12 2xl:col-span-8">
                    <IncomeExpenseCard documents={documents} />
                </div>
                <div className="col-span-12 md:col-span-6 2xl:col-span-4">
                    <UsersCard documents={documents} />
                </div>
                <div className="col-span-12 md:col-span-6 2xl:col-span-4">
                    <TopSuppliersCard documents={documents} />
                </div>
                <div className="col-span-12 md:col-span-6 2xl:col-span-4">
                    <TopCustomerCard documents={documents} />
                </div>
                <div className="col-span-12 md:col-span-6 2xl:col-span-4">
                    <OverallReportCard documents={documents} />
                </div>
                <div className="col-span-12 md:col-span-6 2xl:col-span-4">
                    <PurchaseSalesCard documents={documents} />
                </div>
                <div className="col-span-12 md:col-span-6 2xl:col-span-8">
                    <RecentTransactionsCard documents={documents} />
                </div>

            </div>
        </>
    );
};

export default DocumentsPage;

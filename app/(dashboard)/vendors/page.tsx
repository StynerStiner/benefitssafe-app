"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import CustomSelect from "@/components/shared/custom-select";
import UsersListTable from '@/components/table/users-list-table';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AddVendorForm from "./add-vendor-form";

interface Vendor {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    type: string;
    status: string;
    createdAt: string;
}

const UsersList = () => {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [pageSize, setPageSize] = useState("10");

    useEffect(() => {
        fetch("/api/vendors")
            .then((r) => r.ok ? r.json() : [])
            .then((data) => {
                const list = Array.isArray(data) ? data : (data?.vendors && Array.isArray(data.vendors) ? data.vendors : []);
                setVendors(list);
            })
            .catch(() => {
                setError("Failed to load vendors. Please try refreshing the page.");
            })
            .finally(() => setLoading(false));
    }, []);

    const filteredVendors = useMemo(() => {
        let result = vendors;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter((v) =>
                v.name.toLowerCase().includes(q) ||
                (v.email && v.email.toLowerCase().includes(q)) ||
                (v.phone && v.phone.toLowerCase().includes(q))
            );
        }

        if (statusFilter && statusFilter !== "All") {
            result = result.filter((v) => v.status === statusFilter);
        }

        const limit = parseInt(pageSize, 10);
        if (limit > 0) {
            result = result.slice(0, limit);
        }

        return result;
    }, [vendors, searchQuery, statusFilter, pageSize]);

    return (
        <>
            <DashboardBreadcrumb title="Vendors" text="Vendor Management" />

            {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            <Card className="card h-full !p-0 !block border-0 overflow-hidden mb-6">
                <CardHeader className="border-b border-neutral-200 dark:border-slate-600 !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="flex items-center flex-wrap gap-3">
                        <span className="text-base font-medium text-neutral-500 dark:text-neutral-300 mb-0">Show</span>
                        <CustomSelect
                            placeholder="10"
                            options={["10", "25", "50", "100"]}
                            value={pageSize}
                            onValueChange={setPageSize}
                        />
                        <div className="relative sm:max-w-[388px] w-full">
                            <Input
                                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 shadow-none focus-visible:ring-0 focus-visible:border-primary border border-slate-300 h-10 pe-6 ps-11 w-full dark:border-slate-600 sm:block hidden"
                                placeholder="Search vendors..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <span className="sm:absolute sm:top-[50%] sm:start-0 sm:ms-4 sm:-translate-y-[50%]">
                                <Search className="text-neutral-500 dark:text-white" width={18} height={18} />
                            </span>
                        </div>
                        <CustomSelect
                            placeholder="Status"
                            options={["All", "PENDING", "APPROVED", "ACTIVE", "BLOCKED", "SUSPENDED", "REJECTED"]}
                            value={statusFilter}
                            onValueChange={setStatusFilter}
                        />
                    </div>
                    <AddVendorForm />
                </CardHeader>

                <CardContent className="card-body p-6">
                    {loading ? (
                        <p className="text-sm text-neutral-500 text-center py-8">Loading vendors...</p>
                    ) : (
                        <UsersListTable vendors={filteredVendors} />
                    )}
                </CardContent>
            </Card>

        </>
    );
};
export default UsersList;

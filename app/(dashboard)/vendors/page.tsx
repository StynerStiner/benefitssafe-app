"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import CustomSelect from "@/components/shared/custom-select";
import SearchBox from "@/components/shared/search-box";
import UsersListTable from '@/components/table/users-list-table';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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

    useEffect(() => {
        fetch("/api/vendors")
            .then((r) => r.ok ? r.json() : [])
            .then((data) => {
                const list = Array.isArray(data) ? data : (data?.vendors && Array.isArray(data.vendors) ? data.vendors : []);
                setVendors(list);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <>
            <DashboardBreadcrumb title="Vendors" text="Vendor Management" />

            <Card className="card h-full !p-0 !block border-0 overflow-hidden mb-6">
                <CardHeader className="border-b border-neutral-200 dark:border-slate-600 !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="flex items-center flex-wrap gap-3">
                        <span className="text-base font-medium text-neutral-500 dark:text-neutral-300 mb-0">Show</span>
                        <CustomSelect
                            placeholder="10"
                            options={["10", "25", "50", "100"]}
                        />
                        <SearchBox />
                        <CustomSelect
                            placeholder="Status"
                            options={["All", "PENDING", "APPROVED", "ACTIVE", "BLOCKED", "SUSPENDED", "REJECTED"]}
                        />
                    </div>
                    <Button className={cn(`w-auto h-11`)} asChild>
                        <Link href="#">
                            <Plus className="w-5 h-5" />
                            Add Vendor
                        </Link>
                    </Button>
                </CardHeader>

                <CardContent className="card-body p-6">
                    {loading ? (
                        <p className="text-sm text-neutral-500 text-center py-8">Loading vendors...</p>
                    ) : (
                        <UsersListTable vendors={vendors} />
                    )}
                </CardContent>
            </Card>

        </>
    );
};
export default UsersList;

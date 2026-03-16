"use client";

import UsersGridCard from "@/app/(dashboard)/team/users-grid-card";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import CustomSelect from "@/components/shared/custom-select";
import SearchBox from "@/components/shared/search-box";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface TeamUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    avatarUrl: string | null;
    isActive: boolean;
    createdAt: string;
}

const UsersGrid = () => {
    const [users, setUsers] = useState<TeamUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/users")
            .then((r) => r.ok ? r.json() : { users: [] })
            .then((data) => {
                const list = Array.isArray(data) ? data : (data?.users && Array.isArray(data.users) ? data.users : []);
                setUsers(list);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <>
            <DashboardBreadcrumb title="Team" text="Team Management" />

            <Card className="card h-full !p-0 !block border-0 overflow-hidden">
                <CardHeader className="border-b border-neutral-200 dark:border-slate-600 !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="flex items-center flex-wrap gap-3">
                        <span className="text-base font-medium text-neutral-500 dark:text-neutral-300 mb-0">Show</span>
                        <CustomSelect
                            placeholder="10"
                            options={["10", "25", "50", "100"]}
                        />
                        <SearchBox />
                    </div>
                    <Button className={cn(`w-auto h-11`)} asChild>
                        <Link href="#">
                            <Plus className="w-5 h-5" />
                            Invite Member
                        </Link>
                    </Button>
                </CardHeader>

                <CardContent className="card-body p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-6">
                        {loading ? (
                            <p className="text-sm text-neutral-500 col-span-full text-center py-8">Loading team...</p>
                        ) : (
                            <UsersGridCard users={users} />
                        )}
                    </div>
                </CardContent>
            </Card>

        </>
    );
};
export default UsersGrid;

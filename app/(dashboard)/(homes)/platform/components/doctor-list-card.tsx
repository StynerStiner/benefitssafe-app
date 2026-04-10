"use client";

import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";

interface RecentOrg {
    id: string;
    name: string;
    createdAt: string;
    _count: { users: number };
}

interface DoctorListCardProps {
    recentOrgs: RecentOrg[];
    loading: boolean;
}

const DoctorListCard = ({ recentOrgs, loading }: DoctorListCardProps) => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-0 flex flex-col justify-between gap-8">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h3 className="font-bold text-lg mb-0">Recent Organizations</h3>
                            <CommonLink />
                        </div>
                    </div>
                    <div className="card-body py-4 px-6">
                        <div className="flex flex-col gap-6">
                            {loading ? (
                                <p className="text-sm text-gray-600 dark:text-neutral-100">Loading...</p>
                            ) : recentOrgs.length === 0 ? (
                                <p className="text-sm text-gray-600 dark:text-neutral-100">No organizations yet</p>
                            ) : (
                                recentOrgs.slice(0, 6).map((org) => (
                                    <div className="flex items-center justify-between gap-3" key={org.id}>
                                        <div className="flex items-center">
                                            <span className="w-10 h-10 rounded-full flex-shrink-0 me-3 overflow-hidden bg-primary/10 flex items-center justify-center">
                                                <Building2 className="w-5 h-5 text-primary" />
                                            </span>
                                            <div className="flex-grow-1">
                                                <h6 className="text-base mb-0">{org.name}</h6>
                                                <span className="text-sm text-gray-600 dark:text-neutral-100 font-medium">
                                                    {org._count.users} {org._count.users === 1 ? 'user' : 'users'}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="bg-green-500/15 text-green-500 dark:text-green-500 px-2.5 py-1 rounded-lg font-medium text-sm">Active</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default DoctorListCard;

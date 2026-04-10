"use client";

import { useMemo } from "react";
import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import UserAvatar from "@/components/shared/user-avatar";

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

// Status colors mapping
const statusClasses: Record<string, string> = {
    Active: "text-green-500 dark:text-green-500",
    Pending: "text-yellow-500 dark:text-yellow-500",
    Inactive: "text-neutral-400 dark:text-neutral-400",
};

const fileTypeLabels: Record<string, string> = {
    receipt: "Receipt",
    invoice: "Invoice",
    contract: "Contract",
    grant_letter: "Grant Letter",
};

const UsersCard = ({ documents }: { documents: Document[] }) => {
    const recentUploaders = useMemo(() => {
        // Group by uploader, find most recent upload per user
        const uploaderMap: Record<string, { count: number; latestDate: string; types: Set<string> }> = {};
        documents.forEach((d) => {
            const uid = d.uploadedById;
            if (!uploaderMap[uid]) {
                uploaderMap[uid] = { count: 0, latestDate: d.createdAt, types: new Set() };
            }
            uploaderMap[uid].count++;
            uploaderMap[uid].types.add(d.fileType);
            if (new Date(d.createdAt) > new Date(uploaderMap[uid].latestDate)) {
                uploaderMap[uid].latestDate = d.createdAt;
            }
        });

        return Object.entries(uploaderMap)
            .sort((a, b) => new Date(b[1].latestDate).getTime() - new Date(a[1].latestDate).getTime())
            .slice(0, 5)
            .map(([uploaderId, data], index) => {
                const primaryType = Array.from(data.types)[0];
                return {
                    name: uploaderId.slice(0, 12) + "...",
                    role: `${data.count} ${fileTypeLabels[primaryType] || primaryType || "document"}${data.count > 1 ? "s" : ""}`,
                    status: "Active" as const,
                };
            });
    }, [documents]);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    {/* Header */}
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h3 className="font-bold text-lg mb-0">Recent Uploaders</h3>
                            <CommonLink />
                        </div>
                    </div>

                    {/* Users list */}
                    <div className="flex flex-col gap-7 p-6">
                        {recentUploaders.length === 0 ? (
                            <div className="text-center text-neutral-500 dark:text-neutral-200">
                                No uploaders yet
                            </div>
                        ) : (
                            recentUploaders.map((user, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between gap-4"
                                >
                                    <div className="flex items-center">
                                        <UserAvatar
                                            firstName={user.name.split(" ")[0]}
                                            lastName={user.name.split(" ").slice(1).join(" ")}
                                            size={40}
                                            className="shrink-0 me-3"
                                        />
                                        <div className="grow">
                                            <h6 className="text-base mb-0">{user.name}</h6>
                                            <span className="text-sm text-neutral-600 dark:text-neutral-300 font-normal">
                                                {user.role}
                                            </span>
                                        </div>
                                    </div>
                                    <span
                                        className={`${statusClasses[user.status]} font-medium text-base`}
                                    >
                                        {user.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default UsersCard;

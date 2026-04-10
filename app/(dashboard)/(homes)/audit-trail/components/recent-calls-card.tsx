"use client";

import CommonLink from "@/components/shared/common-link";
import RecentCallsTable from '@/components/table/recent-calls-table';
import { Card, CardContent } from "@/components/ui/card";
import { useMemo } from "react";

interface AuditLog {
    id: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    newValue: Record<string, unknown> | null;
}

const actionColorType = (action: string): "resolved" | "dropped" | "pending" | "danger" | "info" => {
    const upper = action.toUpperCase();
    if (upper === "CREATE") return "resolved";
    if (upper === "UPDATE") return "pending";
    if (upper === "DELETE") return "danger";
    if (upper === "APPROVE") return "info";
    return "dropped";
};

interface UserInfo {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl: string | null;
}

const RecentCallsCard = ({ auditLogs, users = {} }: { auditLogs: AuditLog[]; users?: Record<string, UserInfo> }) => {
    const tableData = useMemo(() => {
        return [...auditLogs]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 6)
            .map((log, index) => {
                const date = new Date(log.createdAt);
                const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                const user = users[log.userId];
                const name = user ? `${user.firstName} ${user.lastName}` : `User ${log.userId.substring(0, 6)}`;

                return {
                    customer: {
                        name,
                        avatarUrl: user?.avatarUrl || null,
                    },
                    type: log.action.charAt(0).toUpperCase() + log.action.slice(1).toLowerCase(),
                    duration: log.entityType,
                    time: formatted,
                    status: {
                        label: "Completed" as const,
                        type: actionColorType(log.action),
                    },
                };
            });
    }, [auditLogs, users]);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div className="flex items-center flex-wrap gap-2 justify-between px-6 py-4">
                    <h3 className="font-bold text-lg mb-0">Recent Audit Entries</h3>
                    <CommonLink />
                </div>

                <div className="">
                    <RecentCallsTable data={tableData} />
                </div>
            </CardContent>
        </Card>
    );
};

export default RecentCallsCard;

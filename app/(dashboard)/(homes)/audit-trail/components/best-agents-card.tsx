"use client";

import CommonLink from "@/components/shared/common-link";
import BestAgentsCardTable from "@/components/table/BestAgentsCardTable";
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

interface UserInfo {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl: string | null;
}

const roleLabels: Record<string, string> = {
    nonprofit_admin: "Admin",
    nonprofit_staff: "Staff",
    beneficiary: "Beneficiary",
    cpa: "CPA",
    auditor: "Auditor",
    attorney: "Attorney",
    vendor: "Vendor",
    platform_admin: "Platform Admin",
    compliance_officer: "Compliance",
    grant_officer: "Grant Officer",
    support: "Support",
    finance_officer: "Finance",
};

const BestAgentsCard = ({ auditLogs, users = {} }: { auditLogs: AuditLog[]; users?: Record<string, UserInfo> }) => {
    const tableData = useMemo(() => {
        const userMap: Record<string, { count: number; lastActive: string; actions: string[] }> = {};

        auditLogs.forEach(log => {
            if (!userMap[log.userId]) {
                userMap[log.userId] = { count: 0, lastActive: log.createdAt, actions: [] };
            }
            userMap[log.userId].count++;
            userMap[log.userId].actions.push(log.action);
            if (new Date(log.createdAt) > new Date(userMap[log.userId].lastActive)) {
                userMap[log.userId].lastActive = log.createdAt;
            }
        });

        return Object.entries(userMap)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([userId, info], index) => {
                const now = new Date();
                const last = new Date(info.lastActive);
                const diffMs = now.getTime() - last.getTime();
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                let timeAgo = "Just now";
                if (diffDays > 0) timeAgo = diffDays + (diffDays === 1 ? " day ago" : " days ago");
                else if (diffHours > 0) timeAgo = diffHours + (diffHours === 1 ? " hr ago" : " hrs ago");

                const user = users[userId];
                const name = user ? `${user.firstName} ${user.lastName}` : `User ${userId.substring(0, 6)}`;
                const role = user ? (roleLabels[user.role] || user.role) : "User";

                return {
                    customer: {
                        name,
                        avatarUrl: user?.avatarUrl || null,
                    },
                    amounts: String(info.count),
                    startDate: timeAgo,
                    endDate: role,
                    duration: "",
                };
            });
    }, [auditLogs, users]);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div className="flex items-center flex-wrap gap-2 justify-between px-6 py-4">
                    <h3 className="font-bold text-lg mb-0">Most Active Users</h3>
                    <CommonLink />
                </div>

                <div className="">
                    <BestAgentsCardTable data={tableData} />
                </div>
            </CardContent>
        </Card>
    );
};

export default BestAgentsCard;

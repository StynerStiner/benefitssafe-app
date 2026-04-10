"use client";

import CommonLink from "@/components/shared/common-link";
import PerformanceAgentsTable from "@/components/table/performance-agents-table";
import { Card, CardContent } from "@/components/ui/card";

interface UserItem {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: string;
}

interface AuditLogItem {
    id: string;
    userId: string;
    action: string;
    entityType: string;
    createdAt: string;
}

interface PerformanceAgentsCardProps {
    users: UserItem[];
    auditLogs: AuditLogItem[];
}

const PerformanceAgentsCard = ({ users, auditLogs }: PerformanceAgentsCardProps) => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div className="flex items-center flex-wrap gap-2 justify-between px-6 py-4">
                    <h3 className="font-bold text-lg mb-0">Performance of Agents</h3>
                    <CommonLink />
                </div>

                {/* Transactions List */}
                <div className="">
                    <PerformanceAgentsTable users={users} auditLogs={auditLogs} />
                </div>
            </CardContent>
        </Card>
    );
};

export default PerformanceAgentsCard;
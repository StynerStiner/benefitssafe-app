"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import { useEffect, useState } from "react";
import AgentEarnings from "./components/agent-earnings";
import BestAgentsCard from "./components/best-agents-card";
import OverallVolume from "./components/overall-volume";
import ReasonCalls from "./components/reason-calls";
import RecentCallsCard from "./components/recent-calls-card";
import SalesCountriesCallCenter from "./components/sales-countries-call-center";
import StateCard from "./components/state-card";

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

const AuditTrailPage = () => {
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [users, setUsers] = useState<Record<string, UserInfo>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch("/api/audit-logs?limit=100").then((r) => {
                if (!r.ok) return [];
                return r.json();
            }),
            fetch("/api/users?limit=200").then((r) => {
                if (!r.ok) return [];
                return r.json();
            }),
        ])
            .then(([logData, userData]) => {
                const logs = Array.isArray(logData) ? logData : (logData?.logs && Array.isArray(logData.logs) ? logData.logs : []);
                setAuditLogs(logs);

                const userList = Array.isArray(userData) ? userData : [];
                const userMap: Record<string, UserInfo> = {};
                userList.forEach((u: UserInfo) => { userMap[u.id] = u; });
                setUsers(userMap);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <>
                <DashboardBreadcrumb title="Audit Trail" text="Activity Log" />
                <LoadingSkeleton />
            </>
        );
    }

    return (
        <>
            <DashboardBreadcrumb title="Audit Trail" text="Activity Log" />

            <div className="">
                <StateCard auditLogs={auditLogs} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                <div className="col-span-12 2xl:col-span-4">
                    <AgentEarnings auditLogs={auditLogs} />
                </div>
                <div className="col-span-12 2xl:col-span-8">
                    <OverallVolume auditLogs={auditLogs} />
                </div>

                <div className="col-span-12 2xl:col-span-6">
                    <SalesCountriesCallCenter auditLogs={auditLogs} />
                </div>

                <div className="col-span-12 2xl:col-span-6">
                    <BestAgentsCard auditLogs={auditLogs} users={users} />
                </div>

                <div className="col-span-12 2xl:col-span-8">
                    <RecentCallsCard auditLogs={auditLogs} users={users} />
                </div>

                <div className="col-span-12 2xl:col-span-4">
                    <ReasonCalls auditLogs={auditLogs} />
                </div>
            </div>
        </>
    );
};
export default AuditTrailPage;

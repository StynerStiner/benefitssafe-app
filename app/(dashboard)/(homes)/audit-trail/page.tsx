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

const AuditTrailPage = () => {
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/audit-logs")
            .then((r) => r.ok ? r.json() : [])
            .then((data) => {
                const logs = Array.isArray(data) ? data : (data?.logs && Array.isArray(data.logs) ? data.logs : []);
                setAuditLogs(logs);
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
                    <BestAgentsCard auditLogs={auditLogs} />
                </div>

                <div className="col-span-12 2xl:col-span-8">
                    <RecentCallsCard auditLogs={auditLogs} />
                </div>

                <div className="col-span-12 2xl:col-span-4">
                    <ReasonCalls auditLogs={auditLogs} />
                </div>
            </div>
        </>
    );
};
export default AuditTrailPage;

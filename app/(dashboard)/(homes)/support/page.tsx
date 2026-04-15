"use client";

import TicketPriorityChart from "@/components/charts/ticket-priority-chart";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import EmptyState from "@/components/shared/empty-state";
import { LifeBuoy } from "lucide-react";
import { Suspense, useState, useEffect, useMemo } from "react";
import PendingSolvedTicketsCard from "./components/pending-solved-tickets-card";
import PerformanceAgentsCard from "./components/performance-agents-card";
import ResponseTimeCard from "./components/response-time-card";
import TaskSummaryCard from "./components/task-summary-card";
import TicketStatusCard from "./components/ticket-status-card";
import TodoListCard from "./components/todo-list-card";
import TopPodcasterCard from "./components/top-podcaster-card";

interface NotificationItem {
    id: string;
    userId: string;
    organizationId: string;
    type: string;
    title: string;
    message: string;
    entityType: string | null;
    entityId: string | null;
    href: string | null;
    read: boolean;
    createdAt: string;
}

interface UserItem {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    role: string;
    isActive: boolean;
    addressCity: string | null;
    addressState: string | null;
}

interface AuditLogItem {
    id: string;
    userId: string;
    organizationId: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
}

const HelpPage = () => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [users, setUsers] = useState<UserItem[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch("/api/notifications?limit=100").then(r => r.ok ? r.json() : { notifications: [] }),
            fetch("/api/users?limit=100").then(r => r.ok ? r.json() : { users: [] }),
            fetch("/api/audit-logs?limit=100").then(r => r.ok ? r.json() : { logs: [] }),
        ]).then(([notifData, userData, logData]) => {
            setNotifications(notifData.notifications || []);
            setUsers(userData.users || []);
            setAuditLogs(logData.logs || []);
            setLoading(false);
        }).catch(() => {
            setLoading(false);
        });
    }, []);

    // Derive ticket priority counts from notification types
    const priorityCounts = useMemo(() => {
        let high = 0, medium = 0, low = 0, urgent = 0;
        const highTypes = ["card_issued", "expense_rejected", "dispute", "vendor_blocked"];
        const mediumTypes = ["expense_submitted", "expense_approved", "vendor_profile_complete"];
        const urgentTypes = ["security", "fraud", "compliance"];

        for (const n of notifications) {
            const t = n.type.toLowerCase();
            if (urgentTypes.some(ut => t.includes(ut))) {
                urgent++;
            } else if (highTypes.some(ht => t.includes(ht.replace("_", "")))) {
                high++;
            } else if (mediumTypes.some(mt => t.includes(mt.replace("_", "")))) {
                medium++;
            } else {
                low++;
            }
        }
        return [high, medium, low, urgent];
    }, [notifications]);

    if (loading) {
        return (
            <>
                <DashboardBreadcrumb title="Support" text="Support" />
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                    <div className="col-span-12"><LoadingSkeleton /></div>
                </div>
            </>
        );
    }

    // Support dashboard derives all its charts from notifications + audit
    // activity. When a brand-new org has neither, every card renders as a
    // zero-height ApexCharts shell that looks broken. Render a single
    // empty state instead until there's something to chart.
    const hasActivity = notifications.length > 0 || auditLogs.length > 0;
    if (!hasActivity) {
        return (
            <>
                <DashboardBreadcrumb title="Support" text="Support" />
                <div className="card rounded-xl border border-border bg-background shadow-sm">
                    <EmptyState
                        icon={LifeBuoy}
                        title="No support activity yet"
                        message="This page surfaces notifications, tickets, and audit events across your team. Charts will populate automatically once your nonprofit starts processing grants, expenses, and beneficiary workflows."
                        ctaLabel="Go to Dashboard"
                        ctaHref="/dashboard"
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <DashboardBreadcrumb title="Support" text="Support" />

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <TaskSummaryCard notifications={notifications} />
                    </Suspense>
                </div>

                <div className="col-span-12 lg:col-span-4">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <div className="shadow-7 p-5 rounded-xl bg-white dark:bg-[#273142] h-full">
                            <div className="flex items-center flex-wrap gap-2 justify-between">
                                <h3 className="mb-0 font-bold text-lg">Ticket Priority</h3>
                            </div>
                            <div className="relative text-style label-bold">
                                <TicketPriorityChart series={priorityCounts} />
                            </div>
                        </div>
                    </Suspense>
                </div>

                <div className="col-span-12 lg:col-span-4">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <TicketStatusCard notifications={notifications} />
                    </Suspense>
                </div>

                <div className="col-span-12 lg:col-span-8">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <PendingSolvedTicketsCard notifications={notifications} />
                    </Suspense>
                </div>

                <div className="col-span-12 lg:col-span-8">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <TodoListCard notifications={notifications} users={users} />
                    </Suspense>
                </div>

                <div className="col-span-12 lg:col-span-4">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <TopPodcasterCard users={users} auditLogs={auditLogs} />
                    </Suspense>
                </div>

                <div className="col-span-12 lg:col-span-8">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <PerformanceAgentsCard users={users} auditLogs={auditLogs} />
                    </Suspense>
                </div>

                <div className="col-span-12 lg:col-span-4">
                    <Suspense fallback={<LoadingSkeleton />}>
                        <ResponseTimeCard auditLogs={auditLogs} />
                    </Suspense>
                </div>
            </div>
        </>
    );
};
export default HelpPage;
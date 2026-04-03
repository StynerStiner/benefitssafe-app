"use client";

import { useState, useEffect, useCallback } from "react";
import EmailSidebar from "@/app/(dashboard)/components/email-sidebar";
import EmailSidebarOverlay from "@/app/(dashboard)/components/email-sidebar-overlay";
import EmailHeader from "@/app/(dashboard)/notifications/components/email-header";
import EmailList from "@/app/(dashboard)/notifications/components/email-list";
import EmailSidebarToggleButton from "@/app/(dashboard)/notifications/components/email-sidebar-toggle-button";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import toast from "react-hot-toast";

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    entityType?: string | null;
    entityId?: string | null;
    href?: string | null;
    read: boolean;
    createdAt: string;
}

const EmailPage = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/notifications?limit=100");
            if (!res.ok) throw new Error("Failed to fetch notifications");
            const data = await res.json();
            setNotifications(data.notifications || []);
        } catch (error) {
            console.error("Error fetching notifications:", error);
            toast.error("Failed to load notifications");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handleMarkAllRead = async () => {
        try {
            const res = await fetch("/api/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ markAllRead: true }),
            });
            if (!res.ok) throw new Error("Failed to mark all as read");
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            toast.success("All notifications marked as read");
        } catch (error) {
            console.error("Error marking all as read:", error);
            toast.error("Failed to mark notifications as read");
        }
    };

    const filteredNotifications = notifications.filter((n) => {
        switch (filter) {
            case "unread":
                return !n.read;
            case "read":
                return n.read;
            case "important":
                return n.type === "compliance_alert" || n.type === "threshold_warning" || n.type === "threshold_critical";
            default:
                return true;
        }
    });

    return (
        <>
            <DashboardBreadcrumb title="Notifications" text="Notifications" />

            <div className="grid grid-cols-1 xl:grid-cols-12 xl:gap-6 relative">
                <EmailSidebarOverlay />

                {/* Sidebar */}
                <div className="col-span-12 xl:col-span-4 2xl:col-span-3">
                    <EmailSidebar
                        notifications={notifications}
                        filter={filter}
                        onFilterChange={setFilter}
                        onMarkAllRead={handleMarkAllRead}
                    />
                </div>

                <div className="col-span-12 xl:col-span-8 2xl:col-span-9">
                    <EmailSidebarToggleButton />

                    <div className="card h-full !p-0 border-0 email-card">
                        <div className="card-header border-b border-neutral-200 dark:border-slate-700 bg-white dark:bg-[#273142] py-4 px-6">
                            <EmailHeader
                                totalCount={filteredNotifications.length}
                                onMarkAllRead={handleMarkAllRead}
                                onRefresh={fetchNotifications}
                            />
                        </div>
                        <div className="card-body p-0">
                            {loading ? (
                                <LoadingSkeleton />
                            ) : (
                                <EmailList notifications={filteredNotifications} />
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </>
    );
};
export default EmailPage;

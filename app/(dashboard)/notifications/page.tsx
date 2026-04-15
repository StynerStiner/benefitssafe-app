"use client";

import { useState, useEffect, useCallback } from "react";
import EmailSidebar from "@/app/(dashboard)/components/email-sidebar";
import EmailSidebarOverlay from "@/app/(dashboard)/components/email-sidebar-overlay";
import EmailHeader from "@/app/(dashboard)/notifications/components/email-header";
import EmailList from "@/app/(dashboard)/notifications/components/email-list";
import EmailSidebarToggleButton from "@/app/(dashboard)/notifications/components/email-sidebar-toggle-button";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import EmptyState from "@/components/shared/empty-state";
import { Bell } from "lucide-react";
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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

    // Fires after any mutation so the navbar bell dropdown can refetch its
    // count/list in the same tab without waiting on the 2-minute poll.
    const notifyDropdown = () => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("notifications:refresh"));
        }
    };

    const handleMarkRead = async (id: string) => {
        const notification = notifications.find((n) => n.id === id);
        if (!notification || notification.read) return;
        // Optimistic update
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        try {
            const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
            if (!res.ok) throw new Error("Failed to mark as read");
            notifyDropdown();
        } catch (error) {
            console.error("Error marking notification as read:", error);
            // Rollback
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
            toast.error("Failed to mark as read");
        }
    };

    const handleDelete = async (id: string) => {
        const snapshot = notifications;
        // Optimistic remove
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
        try {
            const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            toast.success("Notification deleted");
            notifyDropdown();
        } catch {
            setNotifications(snapshot);
            toast.error("Failed to delete notification");
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        const snapshot = notifications;
        setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
        setSelectedIds(new Set());
        try {
            // Parallel DELETEs — path-based, no body (avoids infra layers that
            // strip DELETE bodies).
            const results = await Promise.all(
                ids.map((id) => fetch(`/api/notifications/${id}`, { method: "DELETE" })),
            );
            const failed = results.filter((r) => !r.ok).length;
            if (failed > 0) throw new Error(`${failed} failed`);
            toast.success(`${ids.length} notification${ids.length > 1 ? "s" : ""} deleted`);
            notifyDropdown();
        } catch {
            setNotifications(snapshot);
            toast.error("Failed to delete notifications");
        }
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleMarkAllRead = async () => {
        const snapshot = notifications;
        // Optimistic update — flip every row to read immediately
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        try {
            const res = await fetch("/api/notifications/read-all", { method: "POST" });
            if (!res.ok) throw new Error("Failed to mark all as read");
            toast.success("All notifications marked as read");
            notifyDropdown();
        } catch (error) {
            console.error("Error marking all as read:", error);
            setNotifications(snapshot);
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
                                onDeleteSelected={handleDeleteSelected}
                                selectedCount={selectedIds.size}
                            />
                        </div>
                        <div className="card-body p-0">
                            {loading ? (
                                <LoadingSkeleton />
                            ) : filteredNotifications.length === 0 ? (
                                <EmptyState
                                    icon={Bell}
                                    title={
                                        filter === "all"
                                            ? "No notifications yet"
                                            : filter === "unread"
                                                ? "No unread notifications"
                                                : filter === "read"
                                                    ? "No read notifications"
                                                    : "No important notifications"
                                    }
                                    message={
                                        filter === "all"
                                            ? "You'll see alerts here when grants need attention, cards are issued, or compliance checks flag something."
                                            : "Switch to All to see everything in your inbox."
                                    }
                                />
                            ) : (
                                <EmailList
                                    notifications={filteredNotifications}
                                    onMarkRead={handleMarkRead}
                                    onDelete={handleDelete}
                                    selectedIds={selectedIds}
                                    onToggleSelect={handleToggleSelect}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </>
    );
};
export default EmailPage;

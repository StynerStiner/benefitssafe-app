"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertOctagon, AlertTriangle, FileText, DollarSign, CreditCard, Bell, ShieldCheck, Users, Star } from "lucide-react";
import Link from "next/link";

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

interface EmailListProps {
    notifications: Notification[];
}

function getTypeIcon(type: string) {
    switch (type) {
        case "grant_approved":
        case "grant_created":
            return <FileText className="w-4" />;
        case "expense_submitted":
        case "expense_approved":
        case "expense_rejected":
            return <DollarSign className="w-4" />;
        case "card_issued":
            return <CreditCard className="w-4" />;
        case "compliance_alert":
            return <ShieldCheck className="w-4" />;
        case "threshold_warning":
            return <AlertTriangle className="w-4 text-amber-500" />;
        case "threshold_critical":
            return <AlertOctagon className="w-4 text-red-500" />;
        case "invite_accepted":
        case "vendor_profile_complete":
            return <Users className="w-4" />;
        default:
            return <Bell className="w-4" />;
    }
}

function relativeTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const EmailList = ({ notifications }: EmailListProps) => {
    if (notifications.length === 0) {
        return (
            <div className="flex items-center justify-center py-16">
                <span className="text-neutral-500 dark:text-neutral-300 text-base">No notifications yet</span>
            </div>
        );
    }

    return (
        <ul className="overflow-x-auto">
            {notifications.map((notification) => (
                <li
                    key={notification.id}
                    className={`email-item px-6 py-4 flex gap-4 items-center border-b last:border-0 border-neutral-200 dark:border-slate-700 cursor-pointer hover:bg-neutral-200 dark:hover:bg-slate-800 min-w-max ${
                        notification.type === "threshold_critical"
                            ? "bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500"
                            : notification.type === "threshold_warning"
                                ? "bg-amber-50 dark:bg-amber-900/20 border-l-4 border-l-amber-500"
                                : !notification.read
                                    ? "bg-blue-50 dark:bg-slate-800/50"
                                    : ""
                    }`}
                >
                    <div className="form-check style-check flex items-center">
                        <Checkbox
                            className="border border-neutral-500 w-4 h-4"
                        />
                    </div>
                    <Button variant="link" className="!p-0 bg-transparent starred-button icon text-xl text-neutral-500 dark:text-neutral-300 line-height-1 flex">
                        {getTypeIcon(notification.type)}
                    </Button>
                    <Link href={notification.href || "#"} className="text-neutral-600 dark:text-neutral-200 font-medium text-base text-line-1 w-[190px]">{notification.title}</Link>
                    <Link href={notification.href || "#"} className="text-neutral-600 dark:text-neutral-200 font-medium mb-0 line-clamp-1 max-w-[740px]">{notification.message}</Link>
                    <span className="text-neutral-600 dark:text-neutral-200 font-medium min-w-max-content ms-auto">{relativeTime(notification.createdAt)}</span>
                </li>
            ))}
        </ul>
    );
};

export default EmailList;

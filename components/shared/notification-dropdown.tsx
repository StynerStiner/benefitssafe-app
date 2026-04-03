"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  CreditCard,
  DollarSign,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "grant_approved":
    case "grant_created":
      return <FileText className="w-4 h-4" />;
    case "expense_submitted":
    case "expense_approved":
    case "expense_rejected":
      return <DollarSign className="w-4 h-4" />;
    case "card_issued":
      return <CreditCard className="w-4 h-4" />;
    case "compliance_alert":
      return <ShieldCheck className="w-4 h-4" />;
    case "threshold_warning":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "threshold_critical":
      return <AlertOctagon className="w-4 h-4 text-red-500" />;
    case "invite_accepted":
    case "vendor_profile_complete":
      return <Users className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
}

function getIconBg(type: string): string {
  switch (type) {
    case "threshold_critical":
      return "bg-red-100 dark:bg-red-900/30 text-red-600";
    case "threshold_warning":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-600";
    case "expense_approved":
    case "grant_approved":
      return "bg-green-100 dark:bg-green-900/30 text-green-600";
    case "card_issued":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-600";
    case "compliance_alert":
      return "bg-purple-100 dark:bg-purple-900/30 text-purple-600";
    default:
      return "bg-primary/10 text-primary";
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

const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(() => {
    fetch("/api/notifications?limit=5")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    const handleFocus = () => fetchNotifications();
    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchNotifications]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          className={cn(
            "rounded-[50%] text-neutral-900 sm:w-10 sm:h-10 w-8 h-8 bg-gray-200/75 hover:bg-slate-200 focus-visible:ring-0 dark:bg-slate-700 dark:hover:bg-slate-600 border-0 cursor-pointer data-[state=open]:bg-gray-300 dark:data-[state=open]:bg-slate-600 relative"
          )}
        >
          <Bell className="h-[5.2rem] w-[5.2rem]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="sm:w-[400px] max-h-[unset] me-6 p-0 rounded-2xl overflow-hidden shadow-lg block">
        <div>
          <div className="py-3 px-4 rounded-lg bg-primary/10 dark:bg-primary/25 m-4 flex items-center justify-between gap-2">
            <h6 className="text-lg text-neutral-900 dark:text-white font-semibold mb-0">
              Notifications
            </h6>
            {unreadCount > 0 && (
              <span className="sm:w-10 sm:h-10 w-8 h-8 bg-white dark:bg-slate-800 text-primary dark:text-primary font-bold flex justify-center items-center rounded-full text-sm">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <div className="scroll-sm !border-t-0">
            <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-invisible hover:scrollbar-visible">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.href || "/notifications"}
                    className={`flex px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 justify-between gap-1 ${
                      !n.read ? "bg-blue-50/50 dark:bg-slate-700/50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-10 h-10 flex justify-center items-center rounded-full ${getIconBg(n.type)}`}>
                        {getNotificationIcon(n.type)}
                      </div>
                      <div className="min-w-0">
                        <h6 className="text-sm font-semibold mb-0.5 truncate max-w-[220px]">
                          {n.title}
                        </h6>
                        <p className="mb-0 text-xs text-neutral-500 line-clamp-1">
                          {n.message}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className="text-xs text-neutral-500 dark:text-neutral-300 whitespace-nowrap">
                        {relativeTime(n.createdAt)}
                      </span>
                      {!n.read && (
                        <span className="block w-2 h-2 rounded-full bg-primary mt-1 ml-auto" />
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="text-center py-3 px-4 border-t border-neutral-200 dark:border-slate-700">
              <Link
                href="/notifications"
                className="text-primary dark:text-primary font-semibold hover:underline text-center text-sm"
              >
                View All Notifications
              </Link>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationDropdown;

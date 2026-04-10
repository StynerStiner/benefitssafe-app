"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { useMemo } from "react";
import { useDashboardData } from "@/contexts/DashboardDataContext";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  href?: string;
}

const UserOverviewCard = () => {
  const { data, loading } = useDashboardData();

  const notifications = useMemo<Notification[]>(() => {
    if (!data) return [];
    return (data.notifications?.items ?? []) as Notification[];
  }, [data]);

  if (loading) {
    return (
      <Card className="card">
        <CardContent className="card-body p-0">
          <p className="text-sm text-neutral-500 text-center py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <Card className="card">
      <CardContent className="card-body p-0">
        <h3 className="mb-3 font-semibold text-lg">Recent Notifications</h3>

        {notifications.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-8">No notifications yet.</p>
        ) : (
          <div className="space-y-4">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${n.read ? "bg-neutral-100 dark:bg-neutral-700" : "bg-blue-100 dark:bg-blue-600/25"}`}>
                  <Bell className={`w-4 h-4 ${n.read ? "text-neutral-500" : "text-blue-600 dark:text-blue-400"}`} />
                </div>
                <div className="grow min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{n.title}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserOverviewCard;
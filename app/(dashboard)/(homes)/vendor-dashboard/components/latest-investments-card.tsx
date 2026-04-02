"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const LatestInvestmentsCard = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications?limit=5")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setNotifications(Array.isArray(json) ? json : json.data ?? []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <Card className="card h-full border-0">
      <CardContent className="card-body p-0">
        <h6 className="mb-0 font-bold text-lg">Recent Activity</h6>
        {loading ? (
          <p className="text-sm text-neutral-500 text-center py-8">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-8">No recent activity.</p>
        ) : (
          <div className="space-y-4 mt-4">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${n.read ? "bg-neutral-100 dark:bg-neutral-700" : "bg-blue-100 dark:bg-blue-600/25"}`}>
                  <Bell className={`w-4 h-4 ${n.read ? "text-neutral-500" : "text-blue-600 dark:text-blue-400"}`} />
                </div>
                <div className="grow min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{n.title}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{n.message}</p>
                  <p className="text-xs text-neutral-400 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
export default LatestInvestmentsCard;

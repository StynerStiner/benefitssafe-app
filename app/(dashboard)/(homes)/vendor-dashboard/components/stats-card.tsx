"use client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Building2, CheckCircle, Clock, CreditCard, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

export interface StatCardData {
  id: number;
  title: string;
  value: string;
  difference: string;
  Icon: LucideIcon;
  iconBgColor: string;
  gradientFrom: string;
  changeType: "increase" | "decrease";
}

const StatsCard = () => {
  const [displayStats, setDisplayStats] = useState<StatCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/vendor/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((vendor) => {
        if (!vendor) {
          setDisplayStats([]);
          return;
        }

        const statusMap: Record<string, string> = {
          PENDING: "Pending Review",
          APPROVED: "Approved",
          ACTIVE: "Active",
          DRAFT: "Draft",
          AWAITING_PAYMENT_SETUP: "Awaiting Payment",
          REJECTED: "Rejected",
          BLOCKED: "Blocked",
          SUSPENDED: "Suspended",
        };

        const stats: StatCardData[] = [
          {
            id: 1,
            title: "Organization",
            value: vendor.organization?.name || "N/A",
            difference: vendor.type || "vendor",
            Icon: Building2,
            iconBgColor: "bg-primary",
            gradientFrom: "from-blue-600/10",
            changeType: "increase",
          },
          {
            id: 2,
            title: "Status",
            value: statusMap[vendor.status] || vendor.status,
            difference: vendor.status === "ACTIVE" ? "Verified" : "In progress",
            Icon: vendor.status === "ACTIVE" ? CheckCircle : Clock,
            iconBgColor: vendor.status === "ACTIVE" ? "bg-green-600" : "bg-amber-600",
            gradientFrom: vendor.status === "ACTIVE" ? "from-green-600/10" : "from-amber-600/10",
            changeType: vendor.status === "ACTIVE" ? "increase" : "decrease",
          },
          {
            id: 3,
            title: "Payment Method",
            value: vendor.paymentMethod || "Not set",
            difference: vendor.taxIdCollected ? "Tax ID collected" : "Tax ID needed",
            Icon: CreditCard,
            iconBgColor: "bg-purple-600",
            gradientFrom: "from-purple-600/10",
            changeType: vendor.paymentMethod ? "increase" : "decrease",
          },
        ];
        setDisplayStats(stats);
      })
      .catch(() => setDisplayStats([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        {[1, 2].map((i) => (
          <Card key={i} className="px-4 py-4 rounded-lg border border-neutral-200/75 dark:border-neutral-600 h-full">
            <div className="animate-pulse flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex-1">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
            </div>
          </Card>
        ))}
      </>
    );
  }

  return (
    <>
      {displayStats.map(({ id, title, value, difference, Icon, iconBgColor, gradientFrom, changeType }) => (
        <Card key={id} className={cn("px-4 py-4 rounded-lg border border-neutral-200/75 dark:border-neutral-600 h-full bg-gradient-to-r shadow-none", gradientFrom, "to-white dark:to-slate-700")}>
          <CardContent className="flex items-center space-x-4 p-0">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 flex justify-center items-center shrink-0">
              <span className={cn("w-10 h-10 text-white flex justify-center items-center rounded-lg", iconBgColor)}><Icon size={20} /></span>
            </div>
            <div>
              <p className="text-muted-foreground text-sm text-neutral-700 dark:text-neutral-300">{title}</p>
              <h4 className="font-semibold text-lg mb-1 mt-4">{value}</h4>
              <p className="text-sm">Change{" "}<span className={cn("px-1 py-0.5 rounded-sm font-medium text-sm", changeType === "increase" ? "bg-green-100 text-green-600 dark:bg-green-600/50 dark:text-green-400" : "bg-destructive/10 text-destructive dark:bg-red-600/50 dark:text-red-400")}>{difference}</span></p>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
};
export default StatsCard;

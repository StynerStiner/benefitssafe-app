'use client';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DollarSign, FileBarChart2, LucideIcon, Users, Wallet } from "lucide-react";
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

const defaultStats: StatCardData[] = [
  { id: 1, title: "Active Invoices", value: "0", difference: "+0", Icon: FileBarChart2, iconBgColor: "bg-primary", gradientFrom: "from-blue-600/10", changeType: "increase" },
  { id: 2, title: "Total Payments", value: "$0", difference: "+$0", Icon: DollarSign, iconBgColor: "bg-green-600", gradientFrom: "from-green-600/10", changeType: "increase" },
];

interface StatsCardProps {
  stats?: StatCardData[];
}

const StatsCard = ({ stats = defaultStats }: StatsCardProps) => {
  const [displayStats, setDisplayStats] = useState<StatCardData[]>(defaultStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If stats are passed as props, use them
    if (stats && stats.length > 0) {
      setDisplayStats(stats);
      setLoading(false);
      return;
    }

    // Otherwise try to fetch from API
    fetch("/api/vendor/stats")
      .then((res) => res.ok ? res.json() : { stats: defaultStats })
      .then((data) => {
        const statsList = Array.isArray(data) ? data : (data?.stats || defaultStats);
        setDisplayStats(statsList);
      })
      .catch(() => setDisplayStats(defaultStats))
      .finally(() => setLoading(false));
  }, [stats]);

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

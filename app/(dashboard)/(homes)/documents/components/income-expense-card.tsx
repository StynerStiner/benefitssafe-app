"use client";

import { useMemo, useState } from "react";
import DoubleLineChart from "@/components/charts/double-line-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";

interface Document {
    id: string;
    entityType: string;
    entityId: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    uploadedById: string;
    organizationId: string;
    createdAt: string;
}

function filterByPeriod<T extends { createdAt: string }>(items: T[], period: string): T[] {
  const now = new Date();
  return items.filter(item => {
    const date = new Date(item.createdAt);
    switch (period) {
      case "Today": return date.toDateString() === now.toDateString();
      case "Weekly": return now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
      case "Monthly": return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      case "Yearly": return date.getFullYear() === now.getFullYear();
      default: return true;
    }
  });
}

const IncomeExpenseCard = ({ documents }: { documents: Document[] }) => {
    const [period, setPeriod] = useState("Monthly");
    const filtered = filterByPeriod(documents, period);
    const stats = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const thisMonthDocs = filtered.filter((d) => {
            const date = new Date(d.createdAt);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const lastMonthDocs = filtered.filter((d) => {
            const date = new Date(d.createdAt);
            return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
        });

        const totalUploads = filtered.length;
        const uploadTrend = lastMonthDocs.length > 0
            ? Math.round(((thisMonthDocs.length - lastMonthDocs.length) / lastMonthDocs.length) * 100)
            : 0;

        // Group by month for chart data (last 12 months)
        const monthlyUploads: number[] = [];
        const monthlyByType: number[] = [];
        for (let i = 11; i >= 0; i--) {
            const m = new Date(currentYear, currentMonth - i, 1);
            const month = m.getMonth();
            const year = m.getFullYear();
            const monthDocs = filtered.filter((d) => {
                const date = new Date(d.createdAt);
                return date.getMonth() === month && date.getFullYear() === year;
            });
            monthlyUploads.push(monthDocs.length);
            monthlyByType.push(monthDocs.filter((d) => d.fileType === "receipt" || d.fileType === "invoice").length);
        }

        const uniqueEntityTypes = new Set(filtered.map((d) => d.entityType)).size;

        return { totalUploads, uploadTrend, thisMonthCount: thisMonthDocs.length, uniqueEntityTypes, monthlyUploads, monthlyByType };
    }, [filtered]);

    const trendUp = stats.uploadTrend >= 0;

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-6 h-full flex flex-col justify-between">

                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <h3 className="font-bold text-lg mb-0">Upload Activity</h3>
                    <CustomSelect
                        placeholder="Monthly"
                        options={["Monthly", "Weekly", "Yearly",]}
                        value={period}
                        onValueChange={setPeriod}
                    />
                </div>

                <ul className="flex flex-wrap items-center justify-center my-3 gap-6">
                    <li className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="w-[8px] h-[8px] rounded-[50rem] bg-blue-500"></span>
                            <span className="text-neutral-600 text-sm dark:text-neutral-100 font-semibold">Uploads </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <h6 className="mb-0">{stats.totalUploads} Files</h6>
                            <span className={`${trendUp ? "text-green-500" : "text-red-600"} flex items-center gap-1 text-sm font-bolder`}>
                                {Math.abs(stats.uploadTrend)}%
                                {trendUp ? <ArrowUp width={12} /> : <ArrowDown width={12} />}
                            </span>
                        </div>
                    </li>
                    <li className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="w-[8px] h-[8px] rounded-[50rem] bg-yellow-500"></span>
                            <span className="text-neutral-600 text-sm dark:text-neutral-100 font-semibold">This Month </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <h6 className="mb-0">{stats.thisMonthCount} Files</h6>
                            <span className={`${trendUp ? "text-green-500" : "text-red-600"} flex items-center gap-1 text-sm font-bolder`}>
                                {Math.abs(stats.uploadTrend)}%
                                {trendUp ? <ArrowUp width={12} /> : <ArrowDown width={12} />}
                            </span>
                        </div>
                    </li>
                </ul>

                <div className="">
                    <DoubleLineChart
                        colors={["#487FFF", "#FF9F29"]}
                        series={[
                            { name: "Total Uploads", data: stats.monthlyUploads },
                            { name: "Receipts & Invoices", data: stats.monthlyByType },
                        ]}
                    />
                </div>

            </CardContent>
        </Card>
    );
};

export default IncomeExpenseCard;

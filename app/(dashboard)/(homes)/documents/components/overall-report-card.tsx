"use client";

import { useMemo, useState } from "react";
import OverallReportChart from "@/components/charts/overall-report-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";

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

const OverallReportCard = ({ documents }: { documents: Document[] }) => {
    const [period, setPeriod] = useState("Monthly");
    const filtered = filterByPeriod(documents, period);
    const { seriesData, labels } = useMemo(() => {
        const typeCounts: Record<string, number> = {};
        filtered.forEach((d) => {
            const type = d.fileType || "other";
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        const labelMap: Record<string, string> = {
            grant_letter: "Grant Docs",
            invoice: "Invoices",
            receipt: "Receipts",
            contract: "Reports",
        };

        const entries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const labels = entries.map(([key]) => labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1));
        const seriesData = entries.map(([, count]) => count);

        return { seriesData: seriesData.length > 0 ? seriesData : [0], labels: labels.length > 0 ? labels : ["No Documents"] };
    }, [filtered]);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    {/* Header */}
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-3 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h3 className="font-bold text-lg mb-0">Document Overview</h3>
                            <CustomSelect
                                placeholder="Monthly"
                                options={["Monthly", "Weekly", "Yearly",]}
                                value={period}
                                onValueChange={setPeriod}
                            />
                        </div>
                    </div>

                    <div className="mx-auto apexcharts-tooltip-z-none mt-8">
                        <OverallReportChart showDataLabels={true} seriesData={seriesData} labels={labels} />
                    </div>

                    <div className="flex flex-wrap gap-5 justify-center mt-12">
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-[2px] bg-blue-500"></span>
                            <span className="text-neutral-600 dark:text-neutral-200">{labels[0] || "Grant Docs"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-[2px] bg-violet-600"></span>
                            <span className="text-neutral-600 dark:text-neutral-200">{labels[1] || "Invoices"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-[2px] bg-yellow-500"></span>
                            <span className="text-neutral-600 dark:text-neutral-200">{labels[2] || "Receipts"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-[2px] bg-green-500"></span>
                            <span className="text-neutral-600 dark:text-neutral-200">{labels[3] || "Reports"}</span>
                        </div>
                    </div>

                </div>
            </CardContent>
        </Card>
    );
};

export default OverallReportCard;

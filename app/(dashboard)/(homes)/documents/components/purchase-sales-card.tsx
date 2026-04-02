"use client";

import { useMemo, useState } from "react";
import CoursesActivityChart from "@/components/charts/courses-activity-chart";
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

const PurchaseSalesCard = ({ documents }: { documents: Document[] }) => {
    const [period, setPeriod] = useState("Monthly");
    const filtered = filterByPeriod(documents, period);
    const { uploadsByDay, receiptsByDay, categories, totalUploads, totalReceipts } = useMemo(() => {
        const dayNames = ["Sun", "Mon", "Tues", "Wed", "Thurs", "Fri", "Sat"];
        const uploadCounts = [0, 0, 0, 0, 0, 0, 0];
        const receiptCounts = [0, 0, 0, 0, 0, 0, 0];

        filtered.forEach((d) => {
            const day = new Date(d.createdAt).getDay();
            uploadCounts[day]++;
            if (d.fileType === "receipt" || d.fileType === "invoice") {
                receiptCounts[day]++;
            }
        });

        // Reorder to start from Monday
        const reorder = (arr: number[]) => [...arr.slice(1), arr[0]];
        const categories = [...dayNames.slice(1), dayNames[0]];

        return {
            uploadsByDay: reorder(uploadCounts),
            receiptsByDay: reorder(receiptCounts),
            categories,
            totalUploads: filtered.length,
            totalReceipts: filtered.filter((d) => d.fileType === "receipt" || d.fileType === "invoice").length,
        };
    }, [filtered]);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    {/* Header */}
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h6 className="font-bold text-lg mb-0">Upload Trends</h6>
                            <CustomSelect
                                placeholder="Monthly"
                                options={["Monthly", "Weekly", "Yearly",]}
                                value={period}
                                onValueChange={setPeriod}
                            />
                        </div>
                    </div>

                    <div className="p-6">
                        <ul className="flex flex-wrap items-center justify-center my-3 gap-4">
                            <li className="flex items-center gap-2">
                                <span className="w-3 h-2 rounded-[50rem] bg-yellow-500"></span>
                                <span className="text-gray-600 dark:text-neutral-200 text-sm font-semibold">
                                    Uploads:
                                    <span className="text-gray-900 dark:text-white font-bold">{totalUploads}</span>
                                </span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-3 h-2 rounded-[50rem] bg-green-500"></span>
                                <span className="text-gray-600 dark:text-neutral-200 text-sm font-semibold">
                                    Receipts & Invoices:
                                    <span className="text-gray-900 dark:text-white font-bold"> {totalReceipts}</span>
                                </span>
                            </li>
                        </ul>

                        <div className="-m-4">
                            <CoursesActivityChart
                                height={250}
                                series={[
                                    { name: "All Uploads", data: uploadsByDay },
                                    { name: "Receipts & Invoices", data: receiptsByDay },
                                ]}
                                categories={categories}
                            />
                        </div>
                    </div>

                </div>
            </CardContent>
        </Card>
    );
};

export default PurchaseSalesCard;

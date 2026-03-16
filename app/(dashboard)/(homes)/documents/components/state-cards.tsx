"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
    ArrowDownRight,
    ArrowUpRight,
    FileText,
    FolderOpen,
    Receipt,
    ScrollText,
} from "lucide-react";

interface Document {
    entityType: string;
}

const colorClasses = {
    cyan: {
        bg: "bg-cyan-600/25",
        gradient: "bg-gradient-to-l from-cyan-500/10 to-cyan-500/20",
        border: "line-bg-cyan",
        text: "text-cyan-600 dark:text-cyan-600",
    },
    violet: {
        bg: "bg-violet-600/25",
        gradient: "bg-gradient-to-l from-violet-500/10 to-violet-500/20",
        border: "line-bg-violet",
        text: "text-violet-600 dark:text-violet-600",
    },
    green: {
        bg: "bg-green-600/25",
        gradient: "bg-gradient-to-l from-green-500/10 to-green-500/20",
        border: "line-bg-green",
        text: "text-green-600 dark:text-green-600",
    },
    red: {
        bg: "bg-yellow-500/25",
        gradient: "bg-gradient-to-l from-yellow-500/10 to-yellow-500/20",
        border: "line-bg-yellow",
        text: "text-yellow-500 dark:text-yellow-500",
    },
};

const StateCards = ({ documents }: { documents: Document[] }) => {
    const total = documents.length;
    const grantDocs = documents.filter((d) => d.entityType === "grant" || d.entityType === "Grant").length;
    const expenseDocs = documents.filter((d) => d.entityType === "expense" || d.entityType === "Expense").length;
    const vendorDocs = documents.filter((d) => d.entityType === "vendor" || d.entityType === "Vendor").length;

    const stateCardsData = [
        { title: "Total Documents", value: total.toLocaleString(), icon: <FolderOpen />, color: colorClasses.cyan, change: total, trend: "up" as const },
        { title: "Grant Docs", value: grantDocs.toLocaleString(), icon: <FileText />, color: colorClasses.violet, change: grantDocs, trend: "up" as const },
        { title: "Expense Docs", value: expenseDocs.toLocaleString(), icon: <Receipt />, color: colorClasses.green, change: expenseDocs, trend: expenseDocs > 0 ? "down" as const : "up" as const },
        { title: "Vendor Docs", value: vendorDocs.toLocaleString(), icon: <ScrollText />, color: colorClasses.red, change: vendorDocs, trend: "up" as const },
    ];

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-6 h-full flex flex-col justify-between">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                    {stateCardsData.map((item, index) => {
                        const isUp = item.trend === "up";

                        return (
                            <div
                                key={index}
                                className="col-span-12 sm:col-span-6 xl:col-span-4 2xl:col-span-3"
                            >
                                <div
                                    className={`px-5 py-4 rounded-[8px] h-full relative overflow-hidden shadow-none ${item.color.gradient} left-line ${item.color.border}`}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-1 mb-2">
                                        <div>
                                            <span className="mb-0.5 font-medium text-neutral-600 dark:text-neutral-200 text-base">
                                                {item.title}
                                            </span>
                                            <h6 className="font-semibold mb-1">{item.value}</h6>
                                        </div>
                                        <span
                                            className={`w-11 h-11 rounded-[8px] inline-flex justify-center items-center text-2xl ${item.color.bg} ${item.color.text}`}
                                        >
                                            {item.icon}
                                        </span>
                                    </div>
                                    <p className="text-sm mb-0 flex items-center gap-2">
                                        <span
                                            className={`px-1 rounded-[2px] font-medium text-sm inline-flex items-center gap-1 ${isUp
                                                ? "bg-green-600/15 text-green-600 dark:text-green-600"
                                                : "bg-red-500/15 text-red-500 dark:text-red-500"
                                                }`}
                                        >
                                            {isUp ? (
                                                <ArrowUpRight width={14} />
                                            ) : (
                                                <ArrowDownRight width={14} />
                                            )}
                                            {item.change}%
                                        </span>
                                        From last month
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

export default StateCards;

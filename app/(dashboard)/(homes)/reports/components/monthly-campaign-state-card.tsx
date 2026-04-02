"use client";

import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { useMemo } from "react";

import SocialIcon1 from "@/public/assets/images/home-nine/socials1.png";
import SocialIcon2 from "@/public/assets/images/home-nine/socials2.png";
import SocialIcon3 from "@/public/assets/images/home-nine/socials3.png";
import SocialIcon4 from "@/public/assets/images/home-nine/socials4.png";
import SocialIcon5 from "@/public/assets/images/home-nine/socials5.png";

interface Expense {
    riskClassification: string | null;
    status: string;
}

const complianceRows = [
    { key: "LIKELY_SAFE", label: "Likely Safe", icon: SocialIcon1, bgClass: "bg-purple-100 dark:bg-purple-600/20", pctColor: "text-green-500" },
    { key: "NEEDS_REVIEW", label: "Needs Review", icon: SocialIcon2, bgClass: "bg-yellow-100 dark:bg-yellow-600/20", pctColor: "text-yellow-600" },
    { key: "LIKELY_RISKY", label: "Likely Risky", icon: SocialIcon3, bgClass: "bg-blue-100 dark:bg-primary/20", pctColor: "text-red-600" },
    { key: "BLOCKED", label: "Blocked", icon: SocialIcon4, bgClass: "bg-green-100 dark:bg-green-500/20", pctColor: "text-red-600" },
    { key: "PENDING", label: "Pending", icon: SocialIcon5, bgClass: "bg-danger-100 dark:bg-red-600/20", pctColor: "text-green-500" },
];

const MonthlyCampaignStateCard = ({ expenses }: { expenses?: Expense[] }) => {
    const rows = useMemo(() => {
        const all = expenses || [];
        const total = all.length || 1;
        return complianceRows.map((row) => {
            const count = row.key === "PENDING"
                ? all.filter((e) => !e.riskClassification).length
                : all.filter((e) => e.riskClassification === row.key).length;
            const pct = ((count / total) * 100).toFixed(1);
            return { ...row, count, pct };
        });
    }, [expenses]);

    const totalExpenses = (expenses || []).length;

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-6 h-full">
                <div className="">
                    <h6 className="font-bold text-lg mb-2">Compliance Overview</h6>
                    <span className="text-neutral-600 dark:text-neutral-200">{totalExpenses.toLocaleString()} Total Expenses</span>
                </div>

                <div className="flex flex-col gap-[22px] mt-8">
                    {rows.map((row) => (
                        <div key={row.key} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-[40px] h-[40px] rounded-[50%] flex justify-center items-center ${row.bgClass} shrink-0`}>
                                    <Image src={row.icon} alt="Icon" className="" />
                                </div>
                                <div className="flex-grow-1">
                                    <h6 className="text-base mb-0 font-semibold">{row.label}</h6>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-neutral-600 dark:text-neutral-200 text-base font-medium">{row.count.toLocaleString()}</span>
                                <span className={`${row.pctColor} text-base font-medium`}>{row.pct}%</span>
                            </div>
                        </div>
                    ))}
                </div>

            </CardContent>
        </Card>
    );
};

export default MonthlyCampaignStateCard;
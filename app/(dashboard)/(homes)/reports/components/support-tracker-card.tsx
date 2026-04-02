"use client";

import SupportTrackerChart from "@/components/charts/support-tracker-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";
import TicketIcon1 from "@/public/assets/images/home-nine/ticket1.png";
import TicketIcon2 from "@/public/assets/images/home-nine/ticket2.png";
import TicketIcon3 from "@/public/assets/images/home-nine/ticket3.png";
import Image from "next/image";
import { useState, useMemo } from "react";

interface Expense { status: string; createdAt: string; }

function filterByPeriod<T extends { createdAt: string }>(items: T[], period: string): T[] {
    const now = new Date();
    return items.filter(item => {
        const date = new Date(item.createdAt);
        switch (period) {
            case "Weekly": return now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
            case "Monthly": return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            case "Yearly": return date.getFullYear() === now.getFullYear();
            default: return true;
        }
    });
}

const SupportTrackerCard = ({ expenses }: { expenses?: Expense[] }) => {
    const [period, setPeriod] = useState("Monthly");

    const list = useMemo(() => filterByPeriod(expenses || [], period), [expenses, period]);

    const pending = list.filter((e) => e.status === "PENDING").length;
    const approved = list.filter((e) => e.status === "APPROVED").length;
    const rejected = list.filter((e) => e.status === "REJECTED").length;
    const total = list.length;

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-6 h-full flex flex-col justify-between">
                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <h6 className="font-bold text-lg mb-0">Expense Status Tracker</h6>
                    <CustomSelect
                        placeholder="Monthly"
                        options={["Monthly", "Weekly", "Yearly"]}
                        value={period}
                        onValueChange={setPeriod}
                    />
                </div>

                <div className="mt-8 flex flex-wrap gap-6 items-center justify-between">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-[40px] h-[40px] rounded-[50%] flex justify-center items-center bg-blue-100 dark:bg-primary/20 shrink-0">
                                <Image src={TicketIcon1} alt="Icon" className="" />
                            </div>
                            <div className="flex-grow-1">
                                <h6 className="text-base mb-0 font-bold">{pending}</h6>
                                <span className="text-sm text-neutral-600 dark:text-neutral-200 font-normal">Pending</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-[40px] h-[40px] rounded-[50%] flex justify-center items-center bg-yellow-100 dark:bg-yellow-600/20 shrink-0">
                                <Image src={TicketIcon2} alt="Icon" className="" />
                            </div>
                            <div className="flex-grow-1">
                                <h6 className="text-base mb-0 font-bold">{approved}</h6>
                                <span className="text-sm text-neutral-600 dark:text-neutral-200 font-normal">Approved</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-[40px] h-[40px] rounded-[50%] flex justify-center items-center bg-violet-100 dark:bg-violet-600/20 shrink-0">
                                <Image src={TicketIcon3} alt="Icon" className="" />
                            </div>
                            <div className="flex-grow-1">
                                <h6 className="text-base mb-0 font-bold">{rejected}</h6>
                                <span className="text-sm text-neutral-600 dark:text-neutral-200 font-normal">Rejected</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <SupportTrackerChart />
                        <div className="text-center max-w-[135px] max-h-[135px] bg-yellow-500/15 rounded-[50%] p-4 aspect-ratio-1 flex flex-col justify-center items-center absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 aspect-[1] rtl:translate-x-1/2">
                            <h6 className="font-bold">{total}</h6>
                            <span className="text-neutral-600 dark:text-neutral-200">Total</span>
                        </div>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
};

export default SupportTrackerCard;

"use client";

import CommonLink from '@/components/shared/common-link';
import { Card, CardContent } from '@/components/ui/card';
import OverallReportChart from '@/components/charts/overall-report-chart';
import { useEffect, useState } from 'react';

interface Subscription {
    billingUpdateStatus: string;
    status: string;
}

const StatisticsCard = ({ subscriptions }: { subscriptions: Subscription[] }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const active = subscriptions.filter((s) => s.status === "ACTIVE").length;
    const current = subscriptions.filter((s) => s.billingUpdateStatus === "VERIFIED" || s.billingUpdateStatus === "UPDATED").length;
    const pending = subscriptions.filter((s) => s.billingUpdateStatus === "PENDING" || s.billingUpdateStatus === "CARD_ISSUED").length;
    const needsUpdate = subscriptions.filter((s) => s.billingUpdateStatus === "CARD_SHARED").length;
    const total = Math.max(active + pending + current + needsUpdate, 1);

    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-semibold text-lg mb-0 text-foreground">Billing Status</h3>
                    <CommonLink />
                </div>
                <div className="flex items-center gap-5 flex-sm-nowrap flex-wrap pt-6">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div className="">
                                <span className="w-[20px] h-[20px] bg-blue-600 rounded-[50%] relative">
                                    <span
                                        className="w-[10px] h-[10px] bg-blue-100 rounded-[50%] absolute top-[50%] start-[50%] -translate-x-[50%] -translate-y-[50%]"></span>
                                </span>
                            </div>
                            <div className="">
                                <h6 className="mb-0">{active}</h6>
                                <p className="text-neutral-500 dark:text-neutral-200 text-sm">Active</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="">
                                <span
                                    className="w-[20px] h-[20px] bg-yellow-400 rounded-[50%] relative">
                                    <span
                                        className="w-[10px] h-[10px] bg-yellow-100 rounded-[50%] absolute top-[50%] start-[50%] -translate-x-[50%] -translate-y-[50%]"></span>
                                </span>
                            </div>
                            <div className="">
                                <h6 className="mb-0">{pending}</h6>
                                <p className="text-neutral-500 dark:text-neutral-200 text-sm">Pending Setup</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="">
                                <span className="w-[20px] h-[20px] bg-green-600 rounded-[50%] relative">
                                    <span
                                        className="w-[10px] h-[10px] bg-green-100 rounded-[50%] absolute top-[50%] start-[50%] -translate-x-[50%] -translate-y-[50%]"></span>
                                </span>
                            </div>
                            <div className="">
                                <h6 className="mb-0">{current}</h6>
                                <p className="text-neutral-500 dark:text-neutral-200 text-sm">Billing Current</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="">
                                <span className="w-[20px] h-[20px] bg-purple-600 rounded-[50%] relative">
                                    <span
                                        className="w-[10px] h-[10px] bg-purple-100 rounded-[50%] absolute top-[50%] start-[50%] -translate-x-[50%] -translate-y-[50%]"></span>
                                </span>
                            </div>
                            <div className="">
                                <h6 className="mb-0">{needsUpdate}</h6>
                                <p className="text-neutral-500 dark:text-neutral-200 text-sm">Needs Update</p>
                            </div>
                        </div>
                    </div>
                    <div className="">
                        {mounted && <OverallReportChart showDataLabels={false} />}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default StatisticsCard;

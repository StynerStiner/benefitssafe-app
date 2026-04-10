"use client";

import TimeCompletionChart from "@/components/charts/time-completion-chart";
import taskSummaryIcon1 from "@/public/assets/images/homeThirteen/icon/task-summary-icon1.svg";
import taskSummaryIcon2 from "@/public/assets/images/homeThirteen/icon/task-summary-icon2.svg";
import taskSummaryIcon3 from "@/public/assets/images/homeThirteen/icon/task-summary-icon3.svg";
import taskSummaryIcon4 from "@/public/assets/images/homeThirteen/icon/task-summary-icon4.svg";
import moonShapeBorder from "@/public/assets/images/homeThirteen/shape/moon-shape-border.png";
import Image from "next/image";

interface NotificationItem {
    id: string;
    type: string;
    title: string;
    read: boolean;
    createdAt: string;
}

interface TaskSummaryCardProps {
    notifications: NotificationItem[];
}

const TaskSummaryCard = ({ notifications }: TaskSummaryCardProps) => {
    const total = notifications.length;
    const unread = notifications.filter(n => !n.read).length;
    const read = notifications.filter(n => n.read).length;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const due = notifications.filter(n => new Date(n.createdAt) >= sevenDaysAgo).length;

    const completionRate = total > 0 ? Math.round((read / total) * 100) : 0;
    const changePercent = total > 0 ? ((read / total) * 2.73).toFixed(2) : "0.00";

    // Build monthly series for completion chart (last 9 months)
    const monthlyCounts: number[] = [];
    const now = new Date();
    for (let i = 8; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const count = notifications.filter(n => {
            const d = new Date(n.createdAt);
            return d >= monthStart && d <= monthEnd && n.read;
        }).length;
        monthlyCounts.push(count);
    }

    return (
        <div className="shadow-7 p-5 rounded-xl bg-white dark:bg-[#273142] h-full gradient-bg-chart relative z-[1]">
            <div className="flex items-center flex-wrap gap-2 justify-between mb-6">
                <h3 className="mb-0 font-bold text-lg">Support Summary</h3>
            </div>
            <div className="">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                    <div className="col-span-12 sm:col-span-6 2xl:col-span-3">
                        <div className="rounded-xl overflow-hidden p-5 relative z-[1] bg-[linear-gradient(246deg,_#B159FF_5.05%,_#8B08FE_96.12%)]">
                            <Image src={moonShapeBorder} alt="Shape" className="absolute start-0 bottom-0 mb-2.5 -z-[1]" width={158} height={70} />
                            <span className="block text-white mb-6">New Tickets</span>
                            <div className="flex items-center justify-between gap-3">
                                <h5 className="text-white">{unread}</h5>
                                <span className="opacity-25">
                                    <Image src={taskSummaryIcon1} alt="Icon" width={46} height={41} />
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="col-span-12 sm:col-span-6 2xl:col-span-3">
                        <div className="rounded-xl overflow-hidden p-5 relative z-[1] bg-[linear-gradient(245deg,_#7397FD_4.86%,_#5077E5_96.35%)]">
                            <Image src={moonShapeBorder} alt="Shape" className="absolute start-0 bottom-0 mb-2.5 -z-[1]" width={158} height={70} />
                            <span className="block text-white mb-6">Tickets In Progress</span>
                            <div className="flex items-center justify-between gap-3">
                                <h5 className="text-white">{unread}</h5>
                                <span className="opacity-25">
                                    <Image src={taskSummaryIcon2} alt="Icon" width={46} height={41} />
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="col-span-12 sm:col-span-6 2xl:col-span-3">
                        <div className="rounded-xl overflow-hidden p-5 relative z-[1] bg-[linear-gradient(245deg,_#2FD8E4_3.97%,_#04B4C0_96.86%)]">
                            <Image src={moonShapeBorder} alt="Shape" className="absolute start-0 bottom-0 mb-2.5 -z-[1]" width={158} height={70} />
                            <span className="block text-white mb-6">Tickets Due</span>
                            <div className="flex items-center justify-between gap-3">
                                <h5 className="text-white">{due}</h5>
                                <span className="opacity-25">
                                    <Image src={taskSummaryIcon3} alt="Icon" width={46} height={41} />
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="col-span-12 sm:col-span-6 2xl:col-span-3">
                        <div className="rounded-xl overflow-hidden p-5 relative z-[1] bg-[linear-gradient(250deg,_#FFB359_3.29%,_#FB9B29_96.24%)]">
                            <Image src={moonShapeBorder} alt="Shape" className="absolute start-0 bottom-0 mb-2.5 -z-[1]" width={158} height={70} />
                            <span className="block text-white mb-6">Tickets Resolved</span>
                            <div className="flex items-center justify-between gap-3">
                                <h5 className="text-white">{read}</h5>
                                <span className="opacity-25">
                                    <Image src={taskSummaryIcon4} alt="Icon" width={46} height={41} />
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
              <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
                    <div className="">
                        <span className="text-neutral-600 dark:text-neutral-200">On Time Completion Rate</span>
                        <div className="flex items-center gap-3 mt-2">
                            <h5 className="mb-0">{completionRate}%</h5>
                            <div className="flex items-center gap-1 text-success-600 font-semibold">
                                <span className="line-height-1 flex"><i className="ri-arrow-right-up-line"></i></span>
                                <span className="">{changePercent}%</span>
                            </div>
                        </div>
                    </div>
                    <div className="">
                        <div className="apexcharts-tooltip-style-1">
                            <TimeCompletionChart colors={["#487FFF", "#FF9F29"]} series={monthlyCounts} />
                        </div>
                    </div>
                </div>
        </div>
    );
};

export default TaskSummaryCard;
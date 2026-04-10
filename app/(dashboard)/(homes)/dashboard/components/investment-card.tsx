"use client";

import { Card, CardContent } from "@/components/ui/card";

interface Grant {
    totalAmount: string;
    spentAmount: string;
    status: string;
    createdAt: string;
}

interface Expense {
    status: string;
    amount: string;
    createdAt: string;
}

function filterByMonth(items: { createdAt: string }[], month: number, year: number) {
    return items.filter(item => {
        const date = new Date(item.createdAt);
        return date.getMonth() === month && date.getFullYear() === year;
    });
}

const InvestmentCard = ({ grants, expenses, selectedMonth, selectedYear }: { grants: Grant[]; expenses: Expense[]; selectedMonth: number; selectedYear: number }) => {
    const filteredGrants = filterByMonth(grants, selectedMonth, selectedYear) as Grant[];
    const filteredExpenses = filterByMonth(expenses, selectedMonth, selectedYear) as Expense[];

    const totalAllocated = filteredGrants.reduce((sum, g) => sum + parseFloat(g.totalAmount || "0"), 0);
    const totalSpent = filteredGrants.reduce((sum, g) => sum + parseFloat(g.spentAmount || "0"), 0);
    const totalPending = filteredExpenses
        .filter((e) => e.status === "PENDING")
        .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

    const spentPct = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;
    const pendingPct = totalAllocated > 0 ? Math.round((totalPending / totalAllocated) * 100) : 0;
    const remainingPct = Math.max(0, 100 - spentPct - pendingPct);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-3 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h3 className="font-bold text-lg mb-0">Grant Allocation</h3>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="">
                            <p className="text-center text-neutral-600 dark:text-neutral-300 flex items-center gap-2 justify-center">
                                Total Allocated: <span className="font-semibold text-neutral-600 dark:text-neutral-300">${totalAllocated.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                            </p>

                            <div className="mt-10 mb-6 text-center pe-[110px] relative max-w-[282px] mx-auto">
                                <div className="w-[170px] h-[170px] rounded-full z-[1] relative inline-flex justify-center items-center border border-white border-width-2-px">
                                    <img src="assets/images/home-eleven/bg/radial-bg1.png" alt="Image" className="absolute top-0 start-0 -z-[1] w-full h-full object-cover" />
                                    <h5 className="text-white">{spentPct}%</h5>
                                </div>
                                <div className="w-[144px] h-[144px] rounded-full z-[1] inline-flex justify-center items-center border border-white border-width-3-px absolute top-0 end-0 -mt-9">
                                    <img src="assets/images/home-eleven/bg/radial-bg2.png" alt="Image" className="absolute top-0 start-0 -z-[1] w-full h-full object-cover" />
                                    <h5 className="text-white">{pendingPct}%</h5>
                                </div>
                                <div className="w-[110px] h-[110px] rounded-full z-[1] inline-flex justify-center items-center border border-white border-width-3-px absolute bottom-0 start-[50%] translate-x-[-50%] ms-12">
                                    <img src="assets/images/home-eleven/bg/radial-bg3.png" alt="Image" className="absolute top-0 start-0 -z-[1] w-full h-full object-cover" />
                                    <h5 className="text-white">{remainingPct}%</h5>
                                </div>
                            </div>

                            <div className="flex items-center flex-wrap gap-2 justify-between">
                                <div className="flex flex-col items-start">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-[50rem] bg-blue-600"></span>
                                        <span className="text-neutral-600 dark:text-neutral-300 text-sm font-normal">Spent</span>
                                    </div>
                                    <h6 className="text-neutral-600 dark:text-neutral-300 font-semibold mb-0 mt-1.5 text-lg">
                                        ${totalSpent.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                    </h6>
                                </div>
                                <div className="flex flex-col items-start">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-[50rem] bg-purple-600"></span>
                                        <span className="text-neutral-600 dark:text-neutral-300 text-sm font-normal">Pending</span>
                                    </div>
                                    <h6 className="text-neutral-600 dark:text-neutral-300 font-semibold mb-0 mt-1.5 text-lg">
                                        ${totalPending.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                    </h6>
                                </div>
                                <div className="flex flex-col items-start">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-[50rem] bg-green-600"></span>
                                        <span className="text-neutral-600 dark:text-neutral-300 text-sm font-normal">Available</span>
                                    </div>
                                    <h6 className="text-neutral-600 dark:text-neutral-300 font-semibold mb-0 mt-1.5 text-lg">
                                        ${(totalAllocated - totalSpent - totalPending > 0 ? totalAllocated - totalSpent - totalPending : 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                    </h6>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default InvestmentCard;

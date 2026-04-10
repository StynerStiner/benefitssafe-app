import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";

interface Grant {
    totalAmount: string;
    spentAmount: string;
    remainingAmount: string;
}

const QuickTransfer = ({ grants }: { grants: Grant[] }) => {
    const totalAllocated = grants.reduce((sum, g) => sum + parseFloat(g.totalAmount || "0"), 0);
    const totalSpent = grants.reduce((sum, g) => sum + parseFloat(g.spentAmount || "0"), 0);
    const totalRemaining = grants.reduce((sum, g) => sum + parseFloat(g.remainingAmount || "0"), 0);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h3 className="font-bold text-lg mb-0">Grant Summary</h3>
                            <CommonLink />
                        </div>
                    </div>

                    <div className="card-body p-0">
                        <div className="p-5">
                            <div className="relative z-[1] py-8 text-center px-4">
                                <img src="assets/images/home-eleven/bg/bg-orange-gradient.png" alt="Image" className="absolute top-0 start-0 w-full h-full -z-[1]" />
                                <h3 className="text-white">${totalRemaining.toLocaleString("en-US", { maximumFractionDigits: 0 })}</h3>
                                <span className="text-white">Remaining Balance</span>
                            </div>
                        </div>

                        <div className="py-4 px-6">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-600 dark:text-neutral-300 text-sm">Total Allocated</span>
                                    <span className="font-semibold">${totalAllocated.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-600 dark:text-neutral-300 text-sm">Total Spent</span>
                                    <span className="font-semibold">${totalSpent.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-600 dark:text-neutral-300 text-sm">Remaining</span>
                                    <span className="font-semibold text-green-700 dark:text-green-500">${totalRemaining.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                                </div>
                                <div className="mt-2">
                                    <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-600">
                                        <div
                                            className="bg-green-500 h-3 rounded-full"
                                            style={{ width: `${totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-1 text-center">
                                        {totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0}% of total budget spent
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default QuickTransfer;

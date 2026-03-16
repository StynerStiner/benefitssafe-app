import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";

interface Grant {
    categories: { name: string; allocatedAmount: string; spentAmount: string }[];
}

const barColors = ["bg-orange-600", "bg-yellow-600", "bg-yellow-600", "bg-green-600", "bg-green-600", "bg-cyan-600"];
const bgAlternate = [
    "bg-neutral-100 dark:bg-slate-600/25",
    "bg-base",
];

const MonthlyExpenseBreakdown = ({ grants }: { grants: Grant[] }) => {
    // Aggregate categories across all grants
    const catMap = new Map<string, { allocated: number; spent: number }>();
    for (const g of grants) {
        for (const c of g.categories || []) {
            const existing = catMap.get(c.name) || { allocated: 0, spent: 0 };
            existing.allocated += parseFloat(c.allocatedAmount || "0");
            existing.spent += parseFloat(c.spentAmount || "0");
            catMap.set(c.name, existing);
        }
    }

    const categories = Array.from(catMap.entries())
        .sort((a, b) => b[1].allocated - a[1].allocated)
        .slice(0, 6);

    const totalAllocated = categories.reduce((sum, [, d]) => sum + d.allocated, 0);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h6 className="font-bold text-lg mb-0">Budget Breakdown</h6>
                            <CommonLink />
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="mb-3 flex">
                            <svg xmlns="http://www.w3.org/2000/svg" width="464" height="12" viewBox="0 0 464 12" fill="none">
                                <g clipPath="url(#clip0_6886_52892)">
                                    <rect width="464" height="12" rx="6" fill="#6B7280" />
                                    <rect width="464" height="12" rx="6" fill="#06B6D4" />
                                    <rect width="418" height="12" rx="6" fill="#22C55E" />
                                    <rect width="365" height="12" rx="6" fill="#84CC16" />
                                    <rect width="295" height="12" rx="6" fill="#EAB308" />
                                    <rect width="210" height="12" rx="6" fill="#F59E0B" />
                                    <rect width="111" height="12" rx="6" fill="#F97316" />
                                </g>
                                <defs>
                                    <clipPath id="clip0_6886_52892">
                                        <rect width="464" height="12" rx="6" fill="white" />
                                    </clipPath>
                                </defs>
                            </svg>
                        </div>
                        {categories.length === 0 ? (
                            <p className="text-sm text-neutral-500">No budget categories found</p>
                        ) : (
                            categories.map(([name, data], i) => {
                                const pct = totalAllocated > 0 ? Math.round((data.allocated / totalAllocated) * 100) : 0;
                                return (
                                    <div key={name} className={`flex items-center justify-between p-3 ${bgAlternate[i % 2]}`}>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-3 h-2 ${barColors[i % barColors.length]} rounded-[50rem]`}></span>
                                            <span className="text-neutral-600 dark:text-neutral-300">{name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-neutral-600 dark:text-neutral-300">
                                                ${data.spent.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                            </span>
                                            <span className="text-neutral-600 dark:text-neutral-300 font-semibold">{pct}%</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default MonthlyExpenseBreakdown;

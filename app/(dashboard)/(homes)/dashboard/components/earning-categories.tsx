import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import earnCatIcon1 from "@/public/assets/images/home-eleven/icons/earn-cat-icon1.svg";
import earnCatIcon2 from "@/public/assets/images/home-eleven/icons/earn-cat-icon2.svg";
import earnCatIcon3 from "@/public/assets/images/home-eleven/icons/earn-cat-icon3.svg";
import earnCatIcon4 from "@/public/assets/images/home-eleven/icons/earn-cat-icon4.svg";
import Image, { StaticImageData } from "next/image";

interface Grant {
    categories: { id: string; name: string; allocatedAmount: string; spentAmount: string }[];
}

const iconPool: StaticImageData[] = [earnCatIcon1, earnCatIcon2, earnCatIcon3, earnCatIcon4];
const bgPool = [
    "bg-blue-100 dark:bg-blue-600/25",
    "bg-red-100 dark:bg-red-600/25",
    "bg-yellow-200 dark:bg-yellow-600/25",
    "bg-green-200 dark:bg-green-600/25",
];
const progressPool = ["bg-blue-600", "bg-yellow-600", "bg-yellow-500", "bg-green-500"];

const EarningCategories = ({ grants }: { grants: Grant[] }) => {
    // Aggregate all budget categories across grants
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
        .slice(0, 4)
        .map(([name, data], i) => ({
            id: i + 1,
            title: name,
            spent: `$${data.spent.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            allocated: `$${data.allocated.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            percentage: data.allocated > 0 ? Math.round((data.spent / data.allocated) * 100) : 0,
            icon: iconPool[i % iconPool.length],
            iconBg: bgPool[i % bgPool.length],
            progressColor: progressPool[i % progressPool.length],
        }));

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h3 className="font-bold text-lg mb-0">Budget Categories</h3>
                            <CommonLink />
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex flex-col gap-5">
                            {categories.length === 0 ? (
                                <p className="text-sm text-neutral-500">No budget categories found</p>
                            ) : (
                                categories.map((cat) => (
                                    <div key={cat.id} className="flex items-center justify-between gap-4">
                                        <div className="flex items-center w-full gap-4 grow">
                                            <span className={`w-10 h-10 rounded-full flex justify-center items-center shrink-0 ${cat.iconBg}`}>
                                                <Image src={cat.icon} alt={cat.title} width={20} height={20} />
                                            </span>
                                            <div className="grow">
                                                <h6 className="text-sm mb-0">{cat.title}</h6>
                                                <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                                                    {cat.spent} / from {cat.allocated}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="ms-auto">
                                                <div className="w-[66px] bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                                                    <div className={`${cat.progressColor} h-2.5 rounded-full`} style={{ width: `${Math.min(cat.percentage, 100)}%` }}></div>
                                                </div>
                                            </div>
                                            <span className="text-neutral-600 dark:text-neutral-300 text-xs font-semibold">
                                                {cat.percentage}%
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default EarningCategories;

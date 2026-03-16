import homeElevenIcon1 from "@/public/assets/images/home-eleven/icons/home-eleven-icon1.svg";
import homeElevenIcon2 from "@/public/assets/images/home-eleven/icons/home-eleven-icon2.svg";
import homeElevenIcon3 from "@/public/assets/images/home-eleven/icons/home-eleven-icon3.svg";
import homeElevenIcon4 from "@/public/assets/images/home-eleven/icons/home-eleven-icon4.svg";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

interface Grant {
    status: string;
    totalAmount: string;
    spentAmount: string;
}

interface Expense {
    status: string;
}

const StatisticsCard = ({ grants, expenses }: { grants: Grant[]; expenses: Expense[] }) => {
    const totalGrants = grants.length;
    const activeGrants = grants.filter((g) => g.status === "ACTIVE").length;
    const totalAllocated = grants.reduce((sum, g) => sum + parseFloat(g.totalAmount || "0"), 0);
    const totalSpent = grants.reduce((sum, g) => sum + parseFloat(g.spentAmount || "0"), 0);
    const pendingExpenses = expenses.filter((e) => e.status === "PENDING").length;

    const cardData = [
        {
            id: 1,
            title: "Total Grants",
            amount: totalGrants.toLocaleString(),
            lastMonth: `${activeGrants} active`,
            percentage: "Active",
            gradient: "from-[#f2fdff] to-[#d4f7ff]",
            iconBg: "bg-cyan-600",
            icon: homeElevenIcon1,
        },
        {
            id: 2,
            title: "Total Allocated",
            amount: `$${totalAllocated.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            lastMonth: "Grant budgets",
            percentage: "Total",
            gradient: "from-[#f2fdff] to-[#ffefdd]",
            iconBg: "bg-yellow-600",
            icon: homeElevenIcon2,
        },
        {
            id: 3,
            title: "Total Spent",
            amount: `$${totalSpent.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            lastMonth: "Disbursements",
            percentage: "Spent",
            gradient: "from-[#f2fdff] to-[#e9e0ff]",
            iconBg: "bg-violet-600",
            icon: homeElevenIcon3,
        },
        {
            id: 4,
            title: "Pending Expenses",
            amount: pendingExpenses.toLocaleString(),
            lastMonth: "Awaiting review",
            percentage: "Pending",
            gradient: "from-[#deffec] to-[#f6fffa]",
            iconBg: "bg-green-600",
            icon: homeElevenIcon4,
        },
    ];

    return (
        <>
            {cardData.map((card) => (
                <div
                    key={card.id}
                    className="col-span-12 sm:col-span-6 2xl:col-span-3 col-xxl-3 col-sm-6"
                >
                    <div
                        className={`p-4 shadow-none rounded-lg h-full border border-white dark:border-slate-600 bg-gradient-to-r ${card.gradient} dark:from-slate-700 dark:to-slate-800`}
                    >
                        <div className="card-body p-0">
                            <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                                <div className="flex items-center gap-2.5">
                                    <span
                                        className={`mb-0 w-[48px] h-[48px] ${card.iconBg} flex-shrink-0 text-white flex justify-center items-center rounded-full h6`}
                                    >
                                        <Image src={card.icon} alt="Icon" width={24} height={24} />
                                    </span>
                                    <div>
                                        <span className="font-medium text-neutral-600 dark:text-slate-300 text-base">
                                            {card.title}
                                        </span>
                                        <h6 className="font-semibold mt-[2px]">{card.amount}</h6>
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm mb-0 flex items-center flex-wrap gap-3 mt-3 text-neutral-600 dark:text-slate-300">
                                <span className="px-1.5 py-[2px] rounded-[6px] font-medium text-sm flex items-center gap-1 bg-green-600/15 text-green-600 dark:text-green-500">
                                    <ArrowUpRight className="w-4" />
                                    {card.percentage}
                                </span>
                                {card.lastMonth}
                            </p>
                        </div>
                    </div>
                </div>
            ))}
        </>
    );
};

export default StatisticsCard;

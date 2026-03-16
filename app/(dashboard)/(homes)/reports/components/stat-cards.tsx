import { FileText, Receipt, DollarSign, AlertTriangle } from "lucide-react";

interface Grant { spentAmount: string; }
interface Expense { riskClassification: string | null; }

const StatCards = ({ grants, expenses }: { grants?: Grant[]; expenses?: Expense[] }) => {
    const grantList = grants || [];
    const expenseList = expenses || [];
    const totalGrants = grantList.length;
    const totalExpenses = expenseList.length;
    const totalDisbursed = grantList.reduce((sum, g) => sum + parseFloat(g.spentAmount || "0"), 0);
    const complianceFlags = expenseList.filter((e) => {
        const level = e.riskClassification;
        return level === "LIKELY_RISKY" || level === "BLOCKED";
    }).length;

    const cardsData = [
        {
            id: 1,
            title: "Total Grants",
            value: totalGrants.toLocaleString(),
            icon: FileText,
            bgColor: "bg-violet-100 dark:bg-violet-500/10",
            iconBg: "bg-violet-200 dark:bg-violet-500/20 border border-violet-400",
            textColor: "text-violet-500",
        },
        {
            id: 2,
            title: "Total Expenses",
            value: totalExpenses.toLocaleString(),
            icon: Receipt,
            bgColor: "bg-green-100 dark:bg-green-500/10",
            iconBg: "bg-green-200 dark:bg-green-500/20 border border-green-400",
            textColor: "text-green-500",
        },
        {
            id: 3,
            title: "Total Disbursed",
            value: `$${totalDisbursed.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            icon: DollarSign,
            bgColor: "bg-cyan-100 dark:bg-cyan-500/10",
            iconBg: "bg-cyan-200 dark:bg-cyan-500/20 border border-cyan-400",
            textColor: "text-cyan-500",
        },
        {
            id: 4,
            title: "Compliance Flags",
            value: complianceFlags.toLocaleString(),
            icon: AlertTriangle,
            bgColor: "bg-red-100 dark:bg-red-500/10",
            iconBg: "bg-red-200 dark:bg-red-500/20 border border-red-400",
            textColor: "text-red-500",
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            {cardsData.map((card) => {
                const Icon = card.icon;
                return (
                    <div key={card.id} className="col-span-12 sm:col-span-6">
                        <div className={`rounded-lg h-full text-center p-5 ${card.bgColor}`}>
                            <span
                                className={`w-[44px] h-[44px] rounded-lg inline-flex justify-center items-center text-xl mb-3 ${card.iconBg} ${card.textColor}`}
                            >
                                <Icon size={20} />
                            </span>
                            <span className="text-neutral-700 block dark:text-neutral-100">{card.title}</span>
                            <h6 className="mb-0 mt-1">{card.value}</h6>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default StatCards;

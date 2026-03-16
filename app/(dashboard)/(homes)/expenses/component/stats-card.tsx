import { BadgePercent, Box, LucideIcon, ShoppingCart, UsersRound } from 'lucide-react';

interface Expense {
    amount: string;
    status: string;
}

interface StatsCardData {
    title: string;
    value: string;
    icon: LucideIcon;
    textColor: string;
    bgColor: string;
    borderColor: string;
    change: string;
    changeType: 'increase' | 'decrease';
    changeColor: string;
}

const StatsCard = ({ expenses }: { expenses?: Expense[] }) => {
    const list = expenses || [];
    const totalExpenses = list.length;
    const pendingCount = list.filter((e) => e.status === "PENDING").length;
    const totalRequested = list.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
    const approvedTotal = list.filter((e) => e.status === "APPROVED" || e.status === "PAID")
        .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

    const statsData: StatsCardData[] = [
        {
            title: 'Total Expenses',
            value: totalExpenses.toLocaleString(),
            icon: Box,
            textColor: 'text-primary dark:text-primary',
            bgColor: 'bg-primary/20',
            borderColor: 'border-primary/50 dark:border-primary/50',
            change: `${totalExpenses}`,
            changeType: 'increase',
            changeColor: 'text-green-600 dark:text-green-500 bg-green-100 dark:bg-green-600/25',
        },
        {
            title: 'Pending Review',
            value: pendingCount.toLocaleString(),
            icon: UsersRound,
            textColor: 'text-orange-600 dark:text-orange-500',
            bgColor: 'bg-orange-600/20',
            borderColor: 'border-orange-300 dark:border-orange-600/50',
            change: `${pendingCount}`,
            changeType: pendingCount > 0 ? 'decrease' : 'increase',
            changeColor: pendingCount > 0
                ? 'text-yellow-600 dark:text-yellow-500 bg-yellow-100 dark:bg-yellow-600/25'
                : 'text-green-600 dark:text-green-500 bg-green-100 dark:bg-green-600/25',
        },
        {
            title: 'Total Requested',
            value: `$${totalRequested.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            icon: ShoppingCart,
            textColor: 'text-purple-600 dark:text-purple-500',
            bgColor: 'bg-purple-600/20',
            borderColor: 'border-purple-300 dark:border-purple-600/50',
            change: `$${totalRequested.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            changeType: 'increase',
            changeColor: 'text-green-600 dark:text-green-500 bg-green-100 dark:bg-green-600/25',
        },
        {
            title: 'Approved Total',
            value: `$${approvedTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            icon: BadgePercent,
            textColor: 'text-pink-600 dark:text-pink-500',
            bgColor: 'bg-pink-600/20',
            borderColor: 'border-pink-300 dark:border-pink-600/50',
            change: `$${approvedTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            changeType: 'increase',
            changeColor: 'text-green-600 dark:text-green-500 bg-green-100 dark:bg-green-600/25',
        },
    ];

    return (
        <>
            {
                statsData.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={index}
                            className={`card-body p-6 h-full flex flex-col border-b sm:border-e border-neutral-300 dark:border-neutral-600
                            ${(index === statsData.length - 1 || index === statsData.length - 3) ? '!border-e-0' : ''}
                            ${(index === statsData.length - 1 || index === statsData.length - 2) ? '!border-b-0' : ''}`
                            }
                        >
                            <div className="flex flex-wrap items-center justify-between gap-1 mb-0.5">
                                <div>
                                    <span
                                        className={`w-[44px] h-[44px] border ${item.textColor} ${item.bgColor} ${item.borderColor} shrink-0 flex justify-center items-center rounded-lg h6 mb-4`}
                                    >
                                        <Icon className="w-6 h-6" />
                                    </span>
                                    <span className="mb-1 font-medium text-neutral-500 dark:text-neutral-300 text-base">{item.title}</span>
                                    <h6 className="font-semibold text-neutral-900 dark:text-white mt-2 mb-px">{item.value}</h6>
                                </div>
                            </div>
                            <p className="text-sm mb-0 mt-3">
                                Total:{' '}
                                <span
                                    className={`px-1 py-0.5 rounded-sm font-medium text-sm ${item.changeColor}`}
                                >
                                    {item.change}
                                </span>
                            </p>
                        </div>
                    )
                })
            }
        </>
    );
};

export default StatsCard;

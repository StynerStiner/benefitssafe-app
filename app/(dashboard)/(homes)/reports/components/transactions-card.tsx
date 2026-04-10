"use client";

import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";

import PaymentIcon1 from "@/public/assets/images/home-nine/payment1.png";
import PaymentIcon2 from "@/public/assets/images/home-nine/payment2.png";
import PaymentIcon3 from "@/public/assets/images/home-nine/payment3.png";
import PaymentIcon4 from "@/public/assets/images/home-nine/payment4.png";

interface Expense {
    description: string;
    amount: string;
    status: string;
    category: { name: string } | null;
    createdAt: string;
}

const icons = [PaymentIcon1, PaymentIcon2, PaymentIcon3, PaymentIcon4];
const bgColors = [
    "bg-green-200 dark:bg-green-600/20",
    "bg-cyan-200 dark:bg-cyan-600/20",
    "bg-yellow-200 dark:bg-yellow-600/20",
    "bg-violet-200 dark:bg-violet-600/20",
];

const TransactionsCard = ({ expenses }: { expenses?: Expense[] }) => {
    const recentExpenses = (expenses || []).slice(0, 4);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-6 h-full flex flex-col justify-between">
                {/* Header */}
                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <h3 className="font-bold text-lg mb-0">Recent Expenses</h3>
                    <CommonLink />
                </div>

                {/* Transactions List */}
                <div className="mt-8">
                    {recentExpenses.map((exp, index) => {
                        const num = parseFloat(exp.amount) || 0;
                        const isPositive = exp.status === "APPROVED" || exp.status === "PAID";
                        const formatted = `${isPositive ? "+" : "-"}$${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                        return (
                            <div
                                key={index}
                                className={`flex items-center justify-between gap-4 ${index === recentExpenses.length - 1 ? "mb-0" : "mb-6"
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        className={`w-[40px] h-[40px] rounded-full flex justify-center items-center shrink-0 ${bgColors[index % bgColors.length]}`}
                                    >
                                        <Image src={icons[index % icons.length]} alt={exp.description} />
                                    </div>
                                    <div className="flex-grow">
                                        <h6 className="text-base mb-0 font-normal">{exp.description}</h6>
                                        <span className="text-sm text-neutral-600  dark:text-neutral-200 font-normal">
                                            {exp.category?.name || "Uncategorized"}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-neutral-600  dark:text-neutral-200 text-base font-medium">
                                    {formatted}
                                </span>
                            </div>
                        );
                    })}
                    {recentExpenses.length === 0 && (
                        <div className="text-center text-neutral-500 text-sm py-4">
                            No expenses yet
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default TransactionsCard;

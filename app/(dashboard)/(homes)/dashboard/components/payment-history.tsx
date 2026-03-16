import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";

interface Expense {
    id: string;
    description: string;
    amount: string;
    status: string;
    createdAt: string;
    requestedBy: { firstName: string; lastName: string } | null;
}

const statusStyles: Record<string, { label: string; classes: string }> = {
    PENDING: { label: "Pending", classes: "text-yellow-600 bg-yellow-100 dark:bg-yellow-600/25 dark:text-yellow-600" },
    APPROVED: { label: "Approved", classes: "text-green-600 bg-green-100 dark:bg-green-600/25 dark:text-green-600" },
    REJECTED: { label: "Rejected", classes: "text-red-600 bg-red-100 dark:bg-red-600/25 dark:text-red-600" },
    PAID: { label: "Paid", classes: "text-green-600 bg-green-100 dark:bg-green-600/25 dark:text-green-600" },
    CANCELLED: { label: "Cancelled", classes: "text-red-600 bg-red-100 dark:bg-red-600/25 dark:text-red-600" },
};

const PaymentHistory = ({ expenses }: { expenses: Expense[] }) => {
    const recent = expenses.slice(0, 5);

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

    const formatAmount = (a: string) =>
        `$${parseFloat(a || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h6 className="font-bold text-lg mb-0">Recent Expenses</h6>
                            <CommonLink />
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="">
                            {recent.length === 0 ? (
                                <p className="text-sm text-neutral-500">No expenses found</p>
                            ) : (
                                recent.map((exp, i) => {
                                    const style = statusStyles[exp.status] || statusStyles.PENDING;
                                    const isLast = i === recent.length - 1;
                                    return (
                                        <div
                                            key={exp.id}
                                            className={`flex items-center justify-between ${isLast ? "" : "pb-2.5 mb-2.5 border-bottom border-neutral-200"}`}
                                        >
                                            <div className="">
                                                <h6 className="text-base mb-0">{exp.description}</h6>
                                                <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                                                    {formatDate(exp.createdAt)}
                                                    {exp.requestedBy && ` - ${exp.requestedBy.firstName} ${exp.requestedBy.lastName}`}
                                                </span>
                                            </div>
                                            <div className="">
                                                <h6 className="text-sm mb-1">{formatAmount(exp.amount)}</h6>
                                                <span className={`text-xs py-[2px] font-medium rounded-[50rem] px-4 ${style.classes}`}>
                                                    {style.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default PaymentHistory;

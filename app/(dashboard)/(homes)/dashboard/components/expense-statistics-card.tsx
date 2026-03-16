import ExpenseStatisticsChart from "@/components/charts/expense-statistics-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";

interface Expense {
    status: string;
}

const ExpenseStatisticsCard = ({ expenses }: { expenses: Expense[] }) => {
    const pending = expenses.filter((e) => e.status === "PENDING").length;
    const approved = expenses.filter((e) => e.status === "APPROVED").length;
    const rejected = expenses.filter((e) => e.status === "REJECTED").length;
    const paid = expenses.filter((e) => e.status === "PAID").length;

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-3 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h6 className="font-bold text-lg mb-0">Expense Status</h6>
                            <CustomSelect
                                placeholder="Yearly"
                                options={["Yearly", "Monthly", "Weekly", "Today"]}
                            />
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                                <span className="text-xs text-neutral-600 dark:text-neutral-300">Pending ({pending})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                                <span className="text-xs text-neutral-600 dark:text-neutral-300">Approved ({approved})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                                <span className="text-xs text-neutral-600 dark:text-neutral-300">Rejected ({rejected})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                <span className="text-xs text-neutral-600 dark:text-neutral-300">Paid ({paid})</span>
                            </div>
                        </div>
                        <ExpenseStatisticsChart series={[pending, approved, rejected, paid]} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ExpenseStatisticsCard;

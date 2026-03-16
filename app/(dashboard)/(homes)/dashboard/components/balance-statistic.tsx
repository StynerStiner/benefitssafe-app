import GenerateContentChart from '@/components/charts/generate-content-chart';
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";

interface Expense {
    amount: string;
    status: string;
    createdAt: string;
}

const BalanceStatistic = ({ expenses }: { expenses: Expense[] }) => {
    const approved = expenses.filter((e) => e.status === "APPROVED" || e.status === "PAID");
    const totalApproved = approved.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
    const pending = expenses.filter((e) => e.status === "PENDING");
    const totalPending = pending.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

    return (
        <Card className="card">
            <CardContent className="px-0">
                <div className="flex flex-wrap items-center justify-between">
                    <h6 className="text-lg mb-0">Monthly Disbursements</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>
                <ul className="flex flex-wrap items-center justify-center mt-4 gap-3">
                    <li className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        <span className="text-neutral-500 dark:text-neutral-300 text-sm font-semibold">Approved:
                            <span className="text-neutral-600 dark:text-neutral-300 font-bold"> ${totalApproved.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                        </span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                        <span className="text-neutral-500 dark:text-neutral-300 text-sm font-semibold">Pending:
                            <span className="text-neutral-600 dark:text-neutral-300 font-bold"> ${totalPending.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                        </span>
                    </li>
                </ul>

                <div className="mt-4">
                    <GenerateContentChart />
                </div>
            </CardContent>
        </Card>
    );
};

export default BalanceStatistic;

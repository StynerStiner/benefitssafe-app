import AverageDailySalesChart from "@/components/charts/average-daily-sales-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";

interface Expense { amount: string; status: string; createdAt: string; }

const AverageDailySalesCard = ({ expenses }: { expenses?: Expense[] }) => {
    const list = expenses || [];
    const now = new Date();
    const thisMonth = list.filter((e) => {
        const d = new Date(e.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = Math.min(now.getDate(), daysInMonth);
    const totalThisMonth = thisMonth.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
    const avgDaily = currentDay > 0 ? totalThisMonth / currentDay : 0;

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-6 h-full flex flex-col justify-between">
                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <h6 className="font-bold text-lg mb-0">Average Daily Spending</h6>
                    <CustomSelect
                        placeholder="Monthly"
                        options={["Monthly", "Weekly", "Yearly"]}
                    />
                </div>

                <h6 className="text-center my-4">${avgDaily.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h6>

                <AverageDailySalesChart />

            </CardContent>
        </Card>
    );
};

export default AverageDailySalesCard;

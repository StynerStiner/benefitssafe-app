import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp } from 'lucide-react';
import DailySalesChart from '@/components/charts/daily-sales-chart';

interface Expense {
    amount: string;
    status: string;
}

const DailySalesCard = ({ expenses }: { expenses: Expense[] }) => {
    const totalSpending = expenses
        .filter((e) => e.status === "APPROVED" || e.status === "PAID")
        .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

    return (
        <Card className="card h-full border-0 rounded-lg">
            <CardContent className="card-body p-0">
                <h3 className="mb-3 font-bold text-lg">Daily Spending</h3>
                <div className="flex items-center gap-2">
                    <h6 className="font-semibold mb-0">${totalSpending.toLocaleString("en-US", { maximumFractionDigits: 0 })}</h6>
                    <p className="text-sm mb-0">
                        <span className="bg-green-600/25 border border-green-600/25 px-2 py-1 rounded-full font-semibold text-green-600 dark:text-green-400 text-sm inline-flex items-center gap-1">
                            {expenses.length}
                            <ArrowUp className='w-3 h-3' />
                        </span>
                        {" "} expenses
                    </p>
                </div>

                <div className="mt-0">
                    <DailySalesChart chartColor="#487fff" />
                </div>

            </CardContent>
        </Card>
    );
};

export default DailySalesCard;

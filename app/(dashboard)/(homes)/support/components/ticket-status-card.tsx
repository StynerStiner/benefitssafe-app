import MultipleSeriesChartTwo from '@/components/charts/multiple-series-chart-two';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';

const TicketStatusCard = () => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-6">
                <div className="flex items-center flex-wrap gap-2 justify-between pb-6">
                    <h6 className="mb-0 font-bold text-lg">Ticket Status</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>

                <div className="p-4">
                    <MultipleSeriesChartTwo />
                    <div className="flex items-center gap-3 text-sm justify-center mt-6">
                        <span className="text-neutral-600 font-medium">Pending:
                            <span className="font-semibold text-yellow-600 dark:text-yellow-600 ps-1">32</span>
                        </span>
                        <span className="text-neutral-600 font-medium">Hold:
                            <span className="font-semibold text-purple-600 dark:text-purple-600 ps-1">10</span>
                        </span>
                        <span className="text-neutral-600 font-medium">Complete:
                            <span className="font-semibold text-green-600 dark:text-green-600 ps-1">25</span>
                        </span>
                        <span className="text-neutral-600 font-medium">Cancelled:
                            <span className="font-semibold text-red-600 dark:text-red-600 ps-1">28</span>
                        </span>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
};

export default TicketStatusCard;
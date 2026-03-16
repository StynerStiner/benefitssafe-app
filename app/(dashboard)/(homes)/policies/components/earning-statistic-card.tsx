import DoubleLineChartTwo from '@/components/charts/double-line-chart-two';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';

const EarningStatisticCard = ({ policy }: { policy: unknown }) => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-6">
                <div className="flex items-center flex-wrap gap-2 justify-between pb-6">
                    <h6 className="mb-0 font-bold text-lg">Allowed Categories</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>

                <ul className="flex flex-wrap items-center justify-center mb-3 gap-3">
                    <li className="flex items-center gap-2">
                        <span className="w-[12px] h-[8px] rounded-[50rem] bg-blue-600"></span>
                        <span className="text-neutral-600 dark:text-neutral-300 text-sm font-semibold">Allowed
                            <span className="text-blue-light font-bold text-xl ms-1">$26,201</span>
                        </span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-[12px] h-[8px] rounded-[50rem] bg-yellow-500"></span>
                        <span className="text-neutral-600 dark:text-neutral-300 text-sm font-semibold">Blocked
                            <span className="text-blue-light font-bold text-xl ms-1"> $3,120</span>
                        </span>
                    </li>
                </ul>

                <DoubleLineChartTwo colors={["#487FFF", "#FF9F29"]} chartHeight="200" />

            </CardContent>
        </Card>
    );
};

export default EarningStatisticCard;
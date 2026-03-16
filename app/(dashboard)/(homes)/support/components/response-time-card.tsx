import SemiCircleGaugeTwo from '@/components/charts/semi-circle-gauge-two';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

const ResponseTimeCard = () => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-6">
                <div className="flex items-center flex-wrap gap-2 justify-between pb-6">
                    <h6 className="mb-0 font-bold text-lg">Pending Vs Solved Tickets</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>

                <div className="text-center">
                    <div className="relative">
                        <div className="big-semi-circle-gauge flex justify-center">
                            <SemiCircleGaugeTwo />
                        </div>
                        <span className="w-[90px] h-[90px] rounded-full bg-blue-100 dark:bg-blue-900 flex justify-center items-center absolute start-[50%] translate-x-[-50%] rtl:translate-x-[50%] top-[50%] text-blue-600">
                            <Clock className="w-[48px] h-[48px]" />
                        </span>
                    </div>
                    <h3 className="mt-10 mb-0 leading-none">454h</h3>
                    <span className="text-neutral-800 dark:text-neutral-300 mt-4">1 hrs : 22 mins</span>
                </div>

            </CardContent>
        </Card>
    );
};

export default ResponseTimeCard;
import AreaStepline from '@/components/charts/area-stepline';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';

const SalesFigureCard = ({ expenses }: { expenses?: unknown[] }) => {
    return (
        <Card className="card">
            <CardContent className="card-body p-0">
                <div className="flex items-center justify-between">
                    <h6 className="mb-3 font-semibold text-lg">Payment Trends</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>

                <div className="mt-4 space-y-6">
                    <ul className="flex flex-wrap items-center justify-center my-3 gap-4">
                        <li className="flex items-center gap-2">
                            <span className="w-[12px] h-[8px] rounded-[50rem] bg-yellow-400"></span>
                            <span className="text-neutral-600 dark:text-neutral-200 text-sm">Approved
                                <span className="text-primary-light text-xl font-bold line-height-1 ms-1">$15.5k
                                </span>
                            </span>
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-[12px] h-[8px] rounded-[50rem] bg-green-500"></span>
                            <span className="text-neutral-600 dark:text-neutral-200 text-sm">Paid
                                <span className="text-primary-light text-xl font-bold line-height-1 ms-1">$20.5k</span>
                            </span>
                        </li>
                    </ul>
                    <div className="-ms-4">
                        <AreaStepline color1={`#16a34a`} color2={`#FF9F29`} chartHeight={340} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default SalesFigureCard;
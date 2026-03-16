import AudienceStatsChart from '@/components/charts/audience-stats-chart';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';

const AudienceStatsCard = () => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-6">
                <div className="flex items-center flex-wrap gap-2 justify-between pb-6">
                    <h6 className="mb-0 font-bold text-lg">Audience Stats</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>

                <ul className="flex flex-wrap items-center justify-center mb-3 gap-3">
                    <li className="flex items-center gap-2">
                        <span className="w-[12px] h-[8px] rounded-[50rem] bg-blue-500"></span>
                        <span className="text-neutral-600 dark:text-neutral-300 text-sm font-medium">Total Audience:
                            <span className="text-blue-light font-bold text-xl ms-1"> 26,201</span>
                        </span>
                    </li>
                </ul>

                <div className="-mx-6">
                    <AudienceStatsChart />
                </div>

            </CardContent>
        </Card>
    );
};

export default AudienceStatsCard;
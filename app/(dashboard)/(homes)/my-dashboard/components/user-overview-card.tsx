import UserOverviewChart from '@/components/charts/user-overview-chart';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';

const UserOverviewCard = () => {
    return (
        <Card className="card">
            <CardContent className="card-body p-0">
                <div className="flex items-center justify-between">
                    <h6 className="mb-3 font-semibold text-lg">Users Overview</h6>
                    <CustomSelect
                        placeholder="Today"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>

                <div className="apexcharts-tooltip-z-none">
                    <UserOverviewChart />
                </div>

                <ul className="flex flex-wrap items-center justify-between mt-4 gap-3">
                    <li className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-[2px] bg-blue-500"></span>
                        <span className="text-neutral-500 dark:text-neutral-300 text-sm font-normal">New:
                            <span className="text-neutral-500 dark:text-neutral-300 font-semibold">400</span>
                        </span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-[2px] bg-yellow-500"></span>
                        <span className="text-neutral-500 dark:text-neutral-300 text-sm font-normal">Subscribed:
                            <span className="text-neutral-500 dark:text-neutral-300 font-semibold">300</span>
                        </span>
                    </li>
                </ul>

            </CardContent>
        </Card>
    );
};

export default UserOverviewCard;
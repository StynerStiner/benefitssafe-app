import TaskOverviewChart from "@/components/charts/task-overview-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from '@/components/ui/card';

interface Grant {
    status: string;
}

const TasksOverviewCard = ({ grants }: { grants: Grant[] }) => {
    const totalGrants = grants.length;

    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-semibold text-lg mb-0 text-foreground">Grants Overview</h3>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>
                <div className="card-body p-6">
                    <div className="mt-6">
                        <div className="relative">
                            <TaskOverviewChart />
                            <div className="text-center absolute top-[50%] start-[50%] -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2">
                                <span className="text-neutral-500 dark:text-neutral-300">Total Grants</span>
                                <h6 className="mb-0 mt-1">{totalGrants}</h6>
                            </div>
                        </div>
                        <ul className="flex flex-wrap items-center justify-center mt-6 gap-7">
                            <li className="flex items-center gap-2">
                                <span className="w-[12px] h-[12px] rounded-[50%] bg-yellow-500"></span>
                                <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Draft</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-[12px] h-[12px] rounded-[50%] bg-cyan-500"></span>
                                <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Active</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-[12px] h-[12px] rounded-[50%] bg-purple-500"></span>
                                <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Completed</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-[12px] h-[12px] rounded-[50%] bg-red-600"></span>
                                <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Archived</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TasksOverviewCard;

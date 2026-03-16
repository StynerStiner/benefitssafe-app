import DoubleLineChart from "@/components/charts/double-line-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from '@/components/ui/card';

const OverallVolume = ({ auditLogs }: { auditLogs: unknown[] }) => {
    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Activity Volume</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>
                <div className="card-body p-6">
                    <ul className="flex flex-wrap items-center justify-center my-3 gap-3">
                        <li className="flex items-center gap-2">
                            <span className="w-[12px] h-[8px] rounded-[50rem] bg-blue-600"></span>
                            <span className="text-neutral-500 dark:text-neutral-200 text-sm">Creates
                                <span className="text-primary-light text-xl font-bold line-height-1 ms-1">15.5k</span>
                            </span>
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-[12px] h-[8px] rounded-[50rem] bg-yellow-500"></span>
                            <span className="text-neutral-500 dark:text-neutral-200 text-sm">Updates
                                <span className="text-primary-light text-xl font-bold line-height-1 ms-1">20.5k</span>
                            </span>
                        </li>
                    </ul>
                    <DoubleLineChart colors={["#487FFF", "#FF9F29"]} />
                </div>
            </CardContent>
        </Card>
    );
};

export default OverallVolume;
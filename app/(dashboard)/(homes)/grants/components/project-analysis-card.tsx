import ClientPaymentStatusChart from "@/components/charts/client-payment-status-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from '@/components/ui/card';

const ProjectAnalysisCard = ({ grants }: { grants: unknown[] }) => {
    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Grant Analysis</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>
                <div className="card-body p-6">
                    <ul className="flex flex-wrap items-center justify-center gap-6">
                        <li className="flex items-center gap-2">
                            <span className="w-[12px] h-[12px] rounded-[50%] bg-green-500"></span>
                            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Allocated</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-[12px] h-[12px] rounded-[50%] bg-blue-500"></span>
                            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Remaining</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-[12px] h-[12px] rounded-[50%] bg-yellow-500"></span>
                            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Disbursed</span>
                        </li>
                    </ul>
                    <div className="mt-10">
                        <ClientPaymentStatusChart />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ProjectAnalysisCard;
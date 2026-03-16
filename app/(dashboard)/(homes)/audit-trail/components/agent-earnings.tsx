import AgentEarningsChart from "@/components/charts/agent-earnings-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from '@/components/ui/card';

const AgentEarnings = ({ auditLogs }: { auditLogs: unknown[] }) => {
    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">User Activity</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>
                <div className="card-body p-6">
                    <div className="inline-flex items-center gap-3">
                        <span
                            className="bg-green-100 dark:bg-green-500/25 w-[48px] h-[48px] text-xxl rounded-circle flex justify-center items-center text-neutral-500 dark:text-neutral-200">
                            <img src="assets/images/home-sixteen/icon/dollar-bag.png" alt="Icon" />
                        </span>
                        <div>
                            <h6 className="font-semibold mb-0">$50,000</h6>
                            <span className="text-neutral-500 dark:text-neutral-200 mt-1">Total Actions</span>
                        </div>
                    </div>
                    <AgentEarningsChart />
                </div>
            </CardContent>
        </Card>
    );
};

export default AgentEarnings;
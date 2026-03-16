import OverallReportChart from "@/components/charts/overall-report-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";

const OverallReportCard = ({ documents }: { documents: unknown[] }) => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    {/* Header */}
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-3 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h6 className="font-bold text-lg mb-0">Document Overview</h6>
                            <CustomSelect
                                placeholder="Monthly"
                                options={["Monthly", "Weekly", "Yearly",]}
                            />
                        </div>
                    </div>

                    <div className="mx-auto apexcharts-tooltip-z-none mt-8">
                        <OverallReportChart showDataLabels={true} />
                    </div>

                    <div className="flex flex-wrap gap-5 justify-center mt-12">
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-[2px] bg-blue-500"></span>
                            <span className="text-neutral-600 dark:text-neutral-200">Purchase</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-[2px] bg-violet-600"></span>
                            <span className="text-neutral-600 dark:text-neutral-200">Sales</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-[2px] bg-yellow-500"></span>
                            <span className="text-neutral-600 dark:text-neutral-200">Expense</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-[2px] bg-green-500"></span>
                            <span className="text-neutral-600 dark:text-neutral-200">Gross Profit</span>
                        </div>
                    </div>

                </div>
            </CardContent>
        </Card>
    );
};

export default OverallReportCard;
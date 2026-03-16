import CustomerOverviewChart from '@/components/charts/customer-overview-chart';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';

interface Beneficiary {
  benefitPrograms: Record<string, boolean> | null;
  isActive: boolean;
}

const CustomerOverviewCard = ({ beneficiaries }: { beneficiaries: Beneficiary[] }) => {
    const total = beneficiaries.length;
    const active = beneficiaries.filter((b) => b.isActive).length;
    const onSSI = beneficiaries.filter((b) => b.benefitPrograms?.ssi).length;

    return (
        <Card className="card h-full rounded-lg border-0 overflow-hidden">
            <CardContent className="card-body p-0">
                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <h6 className="mb-0 font-bold text-lg">Benefit Programs Overview</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>

                <div className="flex sm:flex-nowrap flex-wrap items-center mt-4">
                    <ul className="shrink-0">
                        <li className="flex items-center gap-2 mb-7">
                            <span className="w-3 h-3 rounded-full bg-green-600"></span>
                            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Total: {total}</span>
                        </li>
                        <li className="flex items-center gap-2 mb-7">
                            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">SSI: {onSSI}</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Active: {active}</span>
                        </li>
                    </ul>
                    <div className="grow apexcharts-tooltip-z-none title-style circle-none donutChart">
                        <CustomerOverviewChart />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default CustomerOverviewCard;

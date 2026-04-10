import AreaChartSingle from '@/components/charts/area-chart-single';
import { Card, CardContent } from '@/components/ui/card';

interface Beneficiary {
  createdAt: string;
}

const RevenueGrowthCard = ({ beneficiaries }: { beneficiaries: Beneficiary[] }) => {
    const total = beneficiaries.length;
    const thisMonth = beneficiaries.filter((b) => {
        const d = new Date(b.createdAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    return (
        <Card className="card h-full rounded-lg border-0">
          <CardContent className="card-body p-0">
            <div className="flex items-center flex-wrap gap-2 justify-between">
              <div>
                <h3 className="mb-0 font-bold text-lg">Enrollment Growth</h3>
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-100">Monthly Report</span>
              </div>
              <div className="text-end">
                <h6 className="mb-0 font-bold text-lg">{total} total</h6>
                <span className="bg-green-100 dark:bg-green-600/25 px-3 py-1 rounded font-medium text-green-600 dark:text-green-400 text-sm">+{thisMonth} this month</span>
              </div>
            </div>
            <AreaChartSingle chartColor="#487fff" chartHeight={162} />
          </CardContent>
        </Card>
    );
};

export default RevenueGrowthCard;

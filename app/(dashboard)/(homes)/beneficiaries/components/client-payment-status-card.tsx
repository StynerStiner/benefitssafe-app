import ClientPaymentStatusChart from '@/components/charts/client-payment-status-chart';
import { Card, CardContent } from '@/components/ui/card';

interface Beneficiary {
  isActive: boolean;
  _count?: { grantsAsBeneficiary?: number; expenseRequests?: number };
}

const ClientPaymentStatusCard = ({ beneficiaries }: { beneficiaries: Beneficiary[] }) => {
  const withGrants = beneficiaries.filter((b) => (b._count?.grantsAsBeneficiary || 0) > 0).length;
  const withExpenses = beneficiaries.filter((b) => (b._count?.expenseRequests || 0) > 0).length;
  const inactive = beneficiaries.filter((b) => !b.isActive).length;

  return (
    <Card className="card h-full rounded-lg border-0">
      <CardContent className="card-body p-0">
        <h6 className="mb-0 font-bold text-lg">Beneficiary Activity</h6>
        <span className="text-sm font-medium text-neutral-500 dark:text-neutral-300">Overview</span>

        <ul className="flex flex-wrap items-center justify-center mt-8">
          <li className="flex items-center gap-2 me-7">
            <span className="w-3 h-3 rounded-full bg-green-600"></span>
            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">With Grants: {withGrants}</span>
          </li>
          <li className="flex items-center gap-2 me-7">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">With Expenses: {withExpenses}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Inactive: {inactive}</span>
          </li>
        </ul>
        <div className="mt-8">
          <ClientPaymentStatusChart />
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientPaymentStatusCard;

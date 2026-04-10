import CommonLink from '@/components/shared/common-link';
import RecentOrdersTable from '@/components/table/recent-orders-table';
import { Card, CardContent } from '@/components/ui/card';

const RecentOrderCard = ({ expenses }: { expenses?: unknown[] }) => {
    return (
        <>
            <Card className="card !p-0 border-0 rounded-xl shadow-none">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-semibold text-lg mb-0 text-foreground">Recent Invoices</h3>
                    <CommonLink />
                </div>
                <CardContent>
                    <RecentOrdersTable />
                </CardContent>
            </Card>
        </>
    );
};

export default RecentOrderCard;
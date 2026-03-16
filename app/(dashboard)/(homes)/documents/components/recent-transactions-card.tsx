import CommonLink from "@/components/shared/common-link";
import InventoryRecentTransactionsTable from "@/components/table/inventory-recent-transactions-table";
import { Card, CardContent } from "@/components/ui/card";

const RecentTransactionsCard = ({ documents }: { documents: unknown[] }) => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    {/* Header */}
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h6 className="font-bold text-lg mb-0">Recent Uploads</h6>
                            <CommonLink />
                        </div>
                    </div>

                    <div className="p-6">
                        <InventoryRecentTransactionsTable />
                    </div>

                </div>
            </CardContent>
        </Card>
    );
};

export default RecentTransactionsCard;
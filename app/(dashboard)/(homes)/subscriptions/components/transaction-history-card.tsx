import CommonLink from '@/components/shared/common-link';
import { Card, CardContent } from '@/components/ui/card';

interface Subscription {
    id: string;
    serviceName: string;
    monthlyCost: string;
    status: string;
    renewalDate: string | null;
    vendor: { name: string } | null;
}

const statusStyles: Record<string, string> = {
    ACTIVE: "text-green-600 bg-green-100 dark:bg-green-600/25",
    PAUSED: "text-yellow-600 bg-yellow-100 dark:bg-yellow-600/25",
    CANCELLED: "text-red-600 bg-red-100 dark:bg-red-600/25",
    PENDING: "text-yellow-600 bg-yellow-100 dark:bg-yellow-600/25",
    EXPIRED: "text-neutral-600 bg-neutral-100 dark:bg-neutral-600/25",
};

const TransactionHistoryCard = ({ subscriptions }: { subscriptions: Subscription[] }) => {
    const recent = subscriptions.slice(0, 6);

    const formatDate = (d: string | null) =>
        d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "-";

    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Subscription List</h6>
                    <CommonLink />
                </div>
                <div className="card-body">
                    {recent.length === 0 ? (
                        <p className="text-sm text-neutral-500">No subscriptions</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {recent.map((sub) => (
                                <div key={sub.id} className="flex items-center justify-between">
                                    <div>
                                        <h6 className="text-sm font-medium mb-0">{sub.serviceName}</h6>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-300">
                                            {sub.vendor?.name || "Unknown"} - Next: {formatDate(sub.renewalDate)}
                                        </span>
                                    </div>
                                    <div className="text-end">
                                        <span className="text-sm font-semibold">${parseFloat(sub.monthlyCost || "0").toFixed(2)}</span>
                                        <span className={`text-xs py-0.5 px-2 rounded-full ml-2 font-medium ${statusStyles[sub.status] || statusStyles.PENDING}`}>
                                            {sub.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default TransactionHistoryCard;

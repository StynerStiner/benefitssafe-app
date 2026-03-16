import CommonLink from '@/components/shared/common-link';
import { Card, CardContent } from '@/components/ui/card';

interface Subscription {
    id: string;
    serviceName: string;
    status: string;
    updatedAt: string;
    vendor: { name: string } | null;
}

const RecentActivityCard = ({ subscriptions }: { subscriptions: Subscription[] }) => {
    const recent = [...subscriptions]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6);

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Recent Changes</h6>
                    <CommonLink />
                </div>
                <div className="card-body">
                    {recent.length === 0 ? (
                        <p className="text-sm text-neutral-500">No recent activity</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {recent.map((sub) => (
                                <div key={sub.id} className="flex items-center justify-between">
                                    <div>
                                        <h6 className="text-sm font-medium mb-0">{sub.serviceName}</h6>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-300">{sub.vendor?.name || "Unknown"}</span>
                                    </div>
                                    <div className="text-end">
                                        <span className="text-xs text-neutral-500">{formatDate(sub.updatedAt)}</span>
                                        <span className="text-xs block text-neutral-600 dark:text-neutral-300 font-medium">{sub.status}</span>
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

export default RecentActivityCard;

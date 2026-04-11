import { Card, CardContent } from '@/components/ui/card';
import CommonLink from '@/components/shared/common-link';
import { getInitials } from '@/lib/utils/get-initials';

interface Expense {
    amount: string;
    requestedBy: { id: string; firstName: string; lastName: string; email: string } | null;
}

const TopCustomersCard = ({ expenses }: { expenses: Expense[] }) => {
    // Group by requestedBy, sum amounts
    const spenderMap = new Map<string, { name: string; email: string; total: number }>();
    for (const e of expenses) {
        if (!e.requestedBy) continue;
        const key = e.requestedBy.id;
        const existing = spenderMap.get(key) || {
            name: `${e.requestedBy.firstName} ${e.requestedBy.lastName}`,
            email: e.requestedBy.email,
            total: 0,
        };
        existing.total += parseFloat(e.amount || "0");
        spenderMap.set(key, existing);
    }

    const topSpenders = Array.from(spenderMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    const colors = ["bg-blue-600", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-red-500"];

    return (
        <Card className="card">
            <CardContent className="card-body p-0">
                <div className="flex items-center justify-between">
                    <h3 className="mb-3 font-semibold text-lg">Top Spenders</h3>
                    <CommonLink />
                </div>

                <div className="mt-4 space-y-6">
                    {topSpenders.length === 0 ? (
                        <p className="text-sm text-neutral-500">No expense data</p>
                    ) : (
                        topSpenders.map((spender, i) => (
                            <div key={spender.email} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className={`w-10 h-10 rounded-full ${colors[i % colors.length]} text-white flex items-center justify-center text-sm font-semibold shrink-0`}>
                                        {getInitials(spender.name)}
                                    </span>
                                    <div>
                                        <h6 className="text-sm font-medium mb-0">{spender.name}</h6>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-300">{spender.email}</span>
                                    </div>
                                </div>
                                <span className="text-sm font-semibold">
                                    ${spender.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default TopCustomersCard;

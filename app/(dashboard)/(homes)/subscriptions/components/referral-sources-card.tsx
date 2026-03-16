import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';

interface Subscription {
    monthlyCost: string;
    vendor: { name: string } | null;
}

const colors = ["bg-blue-600", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-red-500", "bg-cyan-500"];

const ReferralSourcesCard = ({ subscriptions }: { subscriptions: Subscription[] }) => {
    const vendorMap = new Map<string, { count: number; total: number }>();
    for (const s of subscriptions) {
        const name = s.vendor?.name || "Unknown";
        const existing = vendorMap.get(name) || { count: 0, total: 0 };
        existing.count += 1;
        existing.total += parseFloat(s.monthlyCost || "0");
        vendorMap.set(name, existing);
    }

    const vendors = Array.from(vendorMap.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 6);

    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Vendors by Subscription</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>
                <div className="card-body p-6">
                    {vendors.length === 0 ? (
                        <p className="text-sm text-neutral-500">No subscriptions found</p>
                    ) : (
                        <div className="flex flex-col gap-5">
                            {vendors.map(([name, data], i) => (
                                <div key={name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-3 h-3 rounded-full ${colors[i % colors.length]}`}></span>
                                        <span className="text-sm text-neutral-600 dark:text-neutral-300">{name}</span>
                                    </div>
                                    <div className="text-end">
                                        <span className="text-sm font-semibold">${data.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo</span>
                                        <span className="text-xs text-neutral-500 ml-2">({data.count})</span>
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

export default ReferralSourcesCard;

import { Card, CardContent } from '@/components/ui/card';
import CommonLink from '@/components/shared/common-link';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface Expense {
    amount: string;
    category: { name: string } | null;
}

const TopSellingProductCard = ({ expenses }: { expenses: Expense[] }) => {
    const catMap = new Map<string, { count: number; total: number }>();
    for (const e of expenses) {
        const name = e.category?.name || "Uncategorized";
        const existing = catMap.get(name) || { count: 0, total: 0 };
        existing.count += 1;
        existing.total += parseFloat(e.amount || "0");
        catMap.set(name, existing);
    }

    const topCategories = Array.from(catMap.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5);

    return (
        <Card className="card">
            <CardContent className="card-body p-0">
                <div className="flex items-center justify-between">
                    <h6 className="mb-3 font-semibold text-lg">Top Expense Categories</h6>
                    <CommonLink />
                </div>

                <div className="mt-4 space-y-6">
                    <Table className="table-auto">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-sm">Category</TableHead>
                                <TableHead className="text-sm text-center">Expenses</TableHead>
                                <TableHead className="text-sm text-end">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {topCategories.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-neutral-500 py-4">No data</TableCell>
                                </TableRow>
                            ) : (
                                topCategories.map(([name, data]) => (
                                    <TableRow key={name}>
                                        <TableCell className="text-sm font-medium">{name}</TableCell>
                                        <TableCell className="text-sm text-center">{data.count}</TableCell>
                                        <TableCell className="text-sm text-end font-semibold">
                                            ${data.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

export default TopSellingProductCard;

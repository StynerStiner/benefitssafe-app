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
    grant: { id: string; name: string } | null;
    amount: string;
    status: string;
}

const StockReportCard = ({ expenses }: { expenses: Expense[] }) => {
    // Group expenses by grant to show budget status
    const grantMap = new Map<string, { id: string; name: string; totalRequested: number; approvedTotal: number; count: number }>();
    for (const e of expenses) {
        if (!e.grant) continue;
        const existing = grantMap.get(e.grant.id) || { id: e.grant.id, name: e.grant.name, totalRequested: 0, approvedTotal: 0, count: 0 };
        existing.totalRequested += parseFloat(e.amount || "0");
        existing.count += 1;
        if (e.status === "APPROVED" || e.status === "PAID") {
            existing.approvedTotal += parseFloat(e.amount || "0");
        }
        grantMap.set(e.grant.id, existing);
    }

    const grantStats = Array.from(grantMap.values())
        .sort((a, b) => b.totalRequested - a.totalRequested)
        .slice(0, 5);

    return (
        <Card className="card">
            <CardContent className="card-body p-0">
                <div className="flex items-center justify-between">
                    <h6 className="mb-3 font-semibold text-lg">Grant Budget Status</h6>
                    <CommonLink />
                </div>

                <div className="mt-4 space-y-6">
                    <Table className="table-auto">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-sm">Grant</TableHead>
                                <TableHead className="text-sm text-center">Requests</TableHead>
                                <TableHead className="text-sm text-end">Requested</TableHead>
                                <TableHead className="text-sm text-end">Approved</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {grantStats.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-neutral-500 py-4">No data</TableCell>
                                </TableRow>
                            ) : (
                                grantStats.map((g) => (
                                    <TableRow key={g.id}>
                                        <TableCell className="text-sm font-medium">{g.name}</TableCell>
                                        <TableCell className="text-sm text-center">{g.count}</TableCell>
                                        <TableCell className="text-sm text-end">
                                            ${g.totalRequested.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                        </TableCell>
                                        <TableCell className="text-sm text-end font-semibold text-green-600">
                                            ${g.approvedTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
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

export default StockReportCard;

import CommonLink from '@/components/shared/common-link';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Expense {
    id: string;
    description: string;
    amount: string;
    status: string;
    createdAt: string;
    requestedBy: { firstName: string; lastName: string } | null;
    grant: { name: string } | null;
}

const statusVariant: Record<string, "warning" | "success" | "danger" | "info" | "default"> = {
    PENDING: "warning",
    APPROVED: "success",
    REJECTED: "danger",
    PAID: "info",
    CANCELLED: "danger",
};

const RecentOrdersCard = ({ expenses }: { expenses: Expense[] }) => {
    const recent = expenses.slice(0, 8);

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

    const formatAmount = (a: string) =>
        `$${parseFloat(a || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

    return (
        <Card className="card h-full border-0">
            <CardContent className="card-body p-0">
                <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
                    <h6 className="mb-0 font-bold text-lg">Recent Expense Requests</h6>
                    <CommonLink />
                </div>
                <div className="table-responsive scroll-sm">
                    <Table className="table-auto">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-sm">Description</TableHead>
                                <TableHead className="text-sm">Requested By</TableHead>
                                <TableHead className="text-sm">Grant</TableHead>
                                <TableHead className="text-sm">Amount</TableHead>
                                <TableHead className="text-sm">Date</TableHead>
                                <TableHead className="text-sm text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recent.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-neutral-500 py-4">No expenses found</TableCell>
                                </TableRow>
                            ) : (
                                recent.map((exp) => (
                                    <TableRow key={exp.id}>
                                        <TableCell className="text-sm font-medium">{exp.description}</TableCell>
                                        <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">
                                            {exp.requestedBy ? `${exp.requestedBy.firstName} ${exp.requestedBy.lastName}` : "Unknown"}
                                        </TableCell>
                                        <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">
                                            {exp.grant?.name || "N/A"}
                                        </TableCell>
                                        <TableCell className="text-sm font-semibold">{formatAmount(exp.amount)}</TableCell>
                                        <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">{formatDate(exp.createdAt)}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={statusVariant[exp.status] || "default"}>{exp.status}</Badge>
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

export default RecentOrdersCard;

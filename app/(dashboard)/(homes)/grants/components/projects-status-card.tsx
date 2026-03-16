import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface Grant {
    id: string;
    name: string;
    status: string;
    totalAmount: string;
    spentAmount: string;
    remainingAmount: string;
    endDate: string | null;
    beneficiary: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    } | null;
}

const statusColorMap: Record<string, string> = {
    DRAFT: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400",
    ACTIVE: "bg-green-500/15 text-green-500 dark:text-green-500",
    PAUSED: "bg-yellow-500/15 text-yellow-500 dark:text-yellow-500",
    COMPLETED: "bg-purple-500/15 text-purple-500 dark:text-purple-500",
    ARCHIVED: "bg-red-500/15 text-red-500 dark:text-red-500",
};

const ProjectsStatusCard = ({ grants }: { grants: Grant[] }) => {
    const formatCurrency = (val: string) => {
        const num = parseFloat(val || "0");
        return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    };

    const getDaysRemaining = (endDate: string | null) => {
        if (!endDate) return "Ongoing";
        const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (diff < 0) return "Ended";
        return `${diff} Days`;
    };

    const getProgress = (total: string, spent: string) => {
        const t = parseFloat(total || "0");
        const s = parseFloat(spent || "0");
        if (t === 0) return 0;
        return Math.round((s / t) * 100);
    };

    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Grants Status</h6>
                    <CommonLink />
                </div>
                <div className="card-body p-6">
                    <Table className="table-auto border-spacing-0 border-separate">
                        <TableHeader>
                            <TableRow className="border-0">
                                <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600 rounded-tl-lg">
                                    Grant Name
                                </TableHead>
                                <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                                    Beneficiary
                                </TableHead>
                                <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                                    Budget
                                </TableHead>
                                <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                                    Duration
                                </TableHead>
                                <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                                    Spent
                                </TableHead>
                                <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600 rounded-tr-lg">
                                    Status
                                </TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {grants.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 text-center text-neutral-500">
                                        No grants found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                grants.map((grant, index) => {
                                    const isLast = index === grants.length - 1;
                                    const progress = getProgress(grant.totalAmount, grant.spentAmount);
                                    const isOverHalf = progress > 50;

                                    return (
                                        <TableRow key={grant.id}>
                                            <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}>
                                                {grant.name}
                                            </TableCell>
                                            <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}>
                                                {grant.beneficiary ? `${grant.beneficiary.firstName} ${grant.beneficiary.lastName}` : "Unassigned"}
                                            </TableCell>
                                            <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}>
                                                {formatCurrency(grant.totalAmount)}
                                            </TableCell>
                                            <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}>
                                                {getDaysRemaining(grant.endDate)}
                                            </TableCell>
                                            <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}>
                                                <span
                                                    className={`px-1.5 py-1 rounded font-semibold text-sm inline-flex items-center gap-1 ${isOverHalf
                                                        ? "bg-red-500/15 text-red-500"
                                                        : "bg-green-500/15 text-green-500"
                                                        }`}
                                                >
                                                    {isOverHalf ? (
                                                        <ArrowUpRight className="w-4 h-4" />
                                                    ) : (
                                                        <ArrowDownLeft className="w-4 h-4" />
                                                    )}
                                                    {progress}%
                                                </span>
                                            </TableCell>
                                            <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-br-lg" : ""}`}>
                                                <span
                                                    className={`px-4 py-1 rounded font-semibold text-sm ${statusColorMap[grant.status] || statusColorMap.DRAFT}`}
                                                >
                                                    {grant.status}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

export default ProjectsStatusCard;

import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    userId: string;
    newValue: Record<string, unknown> | null;
}

const actionLabels: Record<string, string> = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    approve: "Approved",
    reject: "Rejected",
    ai_chat: "AI Query",
};

const TransactionHistoryCard = ({ auditLogs }: { auditLogs: AuditLog[] }) => {
    const recent = auditLogs.slice(0, 8);

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

    const formatTime = (d: string) =>
        new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h3 className="font-bold text-lg mb-0">Recent Activity</h3>
                            <CommonLink />
                        </div>
                    </div>

                    <div className="p-6">
                        {recent.length === 0 ? (
                            <p className="text-sm text-neutral-500">No recent activity</p>
                        ) : (
                            <Table className="table-auto">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-sm">Action</TableHead>
                                        <TableHead className="text-sm">Entity</TableHead>
                                        <TableHead className="text-sm">Date</TableHead>
                                        <TableHead className="text-sm">Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recent.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-sm font-medium">
                                                {actionLabels[log.action] || log.action}
                                            </TableCell>
                                            <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">
                                                {log.entityType}
                                            </TableCell>
                                            <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">
                                                {formatDate(log.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-sm text-neutral-600 dark:text-neutral-300">
                                                {formatTime(log.createdAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TransactionHistoryCard;

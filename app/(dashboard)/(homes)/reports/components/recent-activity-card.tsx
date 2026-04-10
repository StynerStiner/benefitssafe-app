"use client";

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
    createdAt: string;
}

function formatAction(action: string): { label: string; type: "success" | "warning" | "purple" } {
    const lower = action.toLowerCase();
    if (lower.includes("create") || lower.includes("approve")) return { label: action, type: "success" };
    if (lower.includes("update") || lower.includes("edit")) return { label: action, type: "warning" };
    return { label: action, type: "purple" };
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

const RecentActivityCard = ({ auditLogs }: { auditLogs?: AuditLog[] }) => {
    const logs = (auditLogs || []).slice(0, 5);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div className="flex items-center flex-wrap gap-2 justify-between px-6 py-4">
                    <h3 className="font-bold text-lg mb-0">Audit Activity</h3>
                    <CommonLink />
                </div>

                {/* Audit Logs Table */}
                <div className="">
                    <Table className="table-auto border-spacing-0 border-separate">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-start">
                                    Action
                                </TableHead>
                                <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                                    Entity Type
                                </TableHead>
                                <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                                    Time
                                </TableHead>
                                <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                                    Status
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => {
                                const actionInfo = formatAction(log.action);
                                return (
                                    <TableRow key={log.id}>
                                        <TableCell className="py-3.5 px-6 text-start">
                                            <h6 className="text-base mb-0">{log.action}</h6>
                                        </TableCell>
                                        <TableCell className="py-3.5 px-6 text-center">{log.entityType}</TableCell>
                                        <TableCell className="py-3.5 px-6 text-center">{timeAgo(log.createdAt)}</TableCell>
                                        <TableCell className="py-3.5 px-6 text-center">
                                            <span
                                                className={`px-2.5 py-1 rounded-lg font-medium text-sm
                                                    ${actionInfo.type === "success" && "bg-green-500/15 text-green-600 dark:text-green-600"}
                                                    ${actionInfo.type === "warning" && "bg-yellow-500/15 text-yellow-600 dark:text-yellow-600"}
                                                    ${actionInfo.type === "purple" && "bg-purple-500/15 text-purple-600 dark:text-purple-600"}
                                                `}
                                            >
                                                {actionInfo.label}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {logs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-3.5 px-6 text-center text-neutral-500">
                                        No audit activity yet
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

export default RecentActivityCard;

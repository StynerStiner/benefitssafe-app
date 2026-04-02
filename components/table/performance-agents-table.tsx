"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import UserAvatar from "@/components/shared/user-avatar";

interface UserItem {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: string;
}

interface AuditLogItem {
    id: string;
    userId: string;
    action: string;
    entityType: string;
    createdAt: string;
}

interface PerformanceAgentsTableProps {
    users: UserItem[];
    auditLogs: AuditLogItem[];
}

const PROGRESS_COLORS = [
    "bg-red-600",
    "bg-yellow-600",
    "bg-cyan-600",
    "bg-green-600",
    "bg-primary",
];

const PerformanceAgentsTable = ({ users, auditLogs }: PerformanceAgentsTableProps) => {
    if (!users || users.length === 0) {
        return (
            <div className="p-6 text-center text-neutral-500 dark:text-neutral-400">
                No data yet
            </div>
        );
    }

    // Build per-user audit log stats
    const userLogStats = users.map((user, index) => {
        const userLogs = auditLogs.filter(log => log.userId === user.id);
        const totalTickets = userLogs.length;
        const createLogs = userLogs.filter(log => log.action === "create").length;
        const resolveLogs = userLogs.filter(log =>
            log.action === "approve" || log.action === "update" || log.action === "delete"
        ).length;
        const openTickets = Math.max(0, totalTickets - resolveLogs);
        const satisfaction = totalTickets > 0 ? Math.round((resolveLogs / totalTickets) * 100) : 0;
        const progressBg = PROGRESS_COLORS[index % PROGRESS_COLORS.length];

        return {
            user,
            totalTickets,
            openTickets,
            resolvedTickets: resolveLogs,
            satisfaction,
            progressBg,
        };
    });

    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-start">
                        Agent Name
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        ID Number
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Total Tickets
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Open Tickets
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Resolved Ticket
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-start">
                        Satisfaction Rate
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {userLogStats.map((item, index) => (
                    <TableRow key={index}>
                        {/* Customer */}
                        <TableCell className="py-3.5 px-6 text-start">
                            <div className="flex items-center">
                                <UserAvatar
                                    firstName={item.user.firstName || undefined}
                                    lastName={item.user.lastName || undefined}
                                    size={40}
                                    className="w-10 h-10 rounded-md me-3"
                                />
                                <div>
                                    <h6 className="text-base !font-medium mb-0">
                                        {item.user.firstName || ""} {item.user.lastName || ""}
                                    </h6>
                                </div>
                            </div>
                        </TableCell>

                        {/* ID */}
                        <TableCell className="py-3.5 px-6 text-center">#{item.user.id.slice(-5)}</TableCell>

                        {/* totalTicket */}
                        <TableCell className="py-3.5 px-6 text-center">{item.totalTickets}</TableCell>

                        {/* Amount */}
                        <TableCell className="py-3.5 px-6 text-center">{item.openTickets}</TableCell>

                        {/* date */}
                        <TableCell className="py-3.5 px-6 text-center">{item.resolvedTickets}</TableCell>

                        {/* Status */}
                        <TableCell
                            className={`py-3.5 px-6 text-start}`}
                        >
                            <div className="mx-auto space-y-1">
                                <div className="w-full">
                                    <div className="rounded-full h-2 bg-gray-200 dark:bg-neutral-700">
                                        <div
                                            className={`${item.progressBg} h-2 rounded-full`}
                                            style={{ width: `${item.satisfaction}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <span className="mt-.5 inline-block">{item.satisfaction}%</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default PerformanceAgentsTable;
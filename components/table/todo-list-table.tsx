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
import { Checkbox } from "@radix-ui/react-checkbox";

interface NotificationItem {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
}

interface UserItem {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: string;
}

interface TodoListTableProps {
    notifications: NotificationItem[];
    users: UserItem[];
}

function derivePriority(type: string): string {
    const highTypes = ["card_issued", "expense_rejected", "dispute", "vendor_blocked"];
    const mediumTypes = ["expense_submitted", "expense_approved", "vendor_profile_complete"];
    if (highTypes.some(t => type.toLowerCase().includes(t.replace("_", "")))) return "High";
    if (mediumTypes.some(t => type.toLowerCase().includes(t.replace("_", "")))) return "Medium";
    return "Low";
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TodoListTable = ({ notifications, users }: TodoListTableProps) => {
    if (!notifications || notifications.length === 0) {
        return (
            <div className="p-6 text-center text-neutral-500 dark:text-neutral-400">
                No data yet
            </div>
        );
    }

    const userMap = new Map(users.map(u => [u.id, u]));

    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-start">
                        <Checkbox
                            className="border border-neutral-500 w-4 h-4"
                        />
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        ID
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Ticket Subject
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Assigned To
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Due Date
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Priority
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-16 text-center">
                        Status
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {notifications.map((item, index) => {
                    const user = userMap.get(item.userId);
                    const priority = derivePriority(item.type);
                    const statusLabel = item.read ? "Resolved" : "Open";
                    const statusType = item.read ? "success" : "warning";

                    return (
                        <TableRow key={index}>
                            {/* Customer */}
                            <TableCell className="py-3.5 px-6 text-start">
                                <div className="">
                                    <Checkbox
                                        className="border border-neutral-500 w-4 h-4"
                                    />
                                </div>
                            </TableCell>

                            {/* ID */}
                            <TableCell className="py-3.5 px-6 text-center text-neutral-600 dark:text-neutral-200">#{item.id.slice(-5)}</TableCell>

                            {/* duration */}
                            <TableCell className="py-3.5 px-6 text-center text-neutral-600 dark:text-neutral-200">{item.title}</TableCell>

                            {/* Amount */}
                            <TableCell className="py-3.5 px-6 text-center text-neutral-600 dark:text-neutral-200">
                                <div className="flex items-center justify-center">
                                    <UserAvatar
                                        firstName={user?.firstName || undefined}
                                        lastName={user?.lastName || undefined}
                                        size={40}
                                    />
                                </div>
                            </TableCell>

                            {/* date */}
                            <TableCell className="py-3.5 px-6 text-center text-neutral-600 dark:text-neutral-200">{formatDate(item.createdAt)}</TableCell>

                            <TableCell className="py-3.5 px-6 text-center text-neutral-600 dark:text-neutral-200">{priority}</TableCell>

                            {/* Status */}
                            <TableCell className="py-3.5 px-6 text-center text-neutral-600 dark:text-neutral-200">
                                <span
                                    className={`px-4 py-1.5 rounded-md font-medium text-sm
                                        ${statusType === "success" && "bg-green-500/15 text-green-600 dark:text-green-600"}
                                        ${statusType === "warning" && "bg-yellow-500/15 text-yellow-600 dark:text-yellow-600"}
                                    `}
                                >
                                    {statusLabel}
                                </span>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
};

export default TodoListTable;
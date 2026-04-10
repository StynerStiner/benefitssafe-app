"use client";

import { Card, CardContent } from "@/components/ui/card";
import CommonLink from "@/components/shared/common-link";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface RecentUser {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    createdAt: string;
}

interface LatestAppointmentsCardProps {
    recentUsers: RecentUser[];
    loading: boolean;
}

function formatRole(role: string): string {
    return role
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

const LatestAppointmentsCard = ({ recentUsers, loading }: LatestAppointmentsCardProps) => {
    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-0 flex flex-col justify-between gap-8">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h3 className="font-bold text-lg mb-0">Recent Signups</h3>
                            <CommonLink />
                        </div>
                    </div>
                    <div className="card-body py-4 px-6">
                        {loading ? (
                            <p className="text-sm text-gray-600 dark:text-neutral-100">Loading...</p>
                        ) : recentUsers.length === 0 ? (
                            <p className="text-sm text-gray-600 dark:text-neutral-100">No signups yet</p>
                        ) : (
                            <Table className="table-auto border-spacing-0 border-separate">
                                <TableHeader>
                                    <TableRow className="border-0">
                                        <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-start rounded-tl-lg">
                                            Name
                                        </TableHead>
                                        <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center">
                                            Email
                                        </TableHead>
                                        <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center">
                                            Date
                                        </TableHead>
                                        <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center text-center rounded-tr-lg">
                                            Role
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentUsers.map((user, index) => {
                                        const isLast = index === recentUsers.length - 1;
                                        return (
                                            <TableRow key={index}>
                                                <TableCell
                                                    className={`py-3 px-4 first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 text-start ${isLast ? "rounded-bl-lg" : ""}`}
                                                >
                                                    {user.firstName} {user.lastName}
                                                </TableCell>
                                                <TableCell
                                                    className={`py-3 px-4 first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-bl-lg" : ""}`}
                                                >
                                                    {user.email}
                                                </TableCell>
                                                <TableCell
                                                    className={`py-3 px-4 first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-bl-lg" : ""}`}
                                                >
                                                    {formatDate(user.createdAt)}
                                                </TableCell>
                                                <TableCell
                                                    className={`py-3 px-4 first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-bl-lg" : ""}`}
                                                >
                                                    <div className="text-neutral-600 dark:text-neutral-100">
                                                        <span className="bg-green-500/15 text-green-600 dark:text-green-600 px-2.5 py-1 rounded-lg font-medium text-sm">
                                                            {formatRole(user.role)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default LatestAppointmentsCard;

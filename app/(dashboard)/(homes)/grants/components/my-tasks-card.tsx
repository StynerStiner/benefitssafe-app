"use client";

import CustomSelect from "@/components/shared/custom-select";
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
import { useMemo, useState } from 'react';

interface Grant {
    id: string;
    name: string;
    status: string;
    remainingAmount: string;
    endDate: string | null;
}

const statusVariantMap: Record<string, "warning" | "success" | "info" | "danger" | "default"> = {
    DRAFT: "default",
    ACTIVE: "success",
    PAUSED: "warning",
    COMPLETED: "info",
    ARCHIVED: "danger",
};

const statusFilterMap: Record<string, string> = {
    Active: "ACTIVE",
    Draft: "DRAFT",
    Completed: "COMPLETED",
    Paused: "PAUSED",
};

const MyTasksCard = ({ grants }: { grants: Grant[] }) => {
    const [statusFilter, setStatusFilter] = useState("All");

    const filteredGrants = useMemo(() => {
        if (statusFilter === "All") return grants;
        const dbStatus = statusFilterMap[statusFilter];
        if (!dbStatus) return grants;
        return grants.filter((g) => g.status === dbStatus);
    }, [grants, statusFilter]);

    const formatCurrency = (val: string) => {
        const num = parseFloat(val || "0");
        return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    };

    const formatDate = (val: string | null) => {
        if (!val) return "No end date";
        return new Date(val).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    };

    return (
        <Card className="card p-6 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="pb-4 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Grant Items</h6>
                    <CustomSelect
                        placeholder="All"
                        options={["All", "Active", "Draft", "Completed", "Paused"]}
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                    />
                </div>
                <div className="p-0">
                    <div className="table-responsive scroll-sm">
                        <Table className="table-auto border-spacing-0 border-separate">
                            <TableHeader>
                                <TableRow className="border-0">
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 rounded-tl-lg">
                                        Grant Name
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600">
                                        End Date
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 rounded-tr-lg text-center">
                                        Status
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredGrants.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 text-center text-neutral-500">
                                            No grants found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredGrants.map((grant, index) => {
                                        const isLast = index === filteredGrants.length - 1;
                                        return (
                                            <TableRow key={grant.id}>
                                                <TableCell
                                                    className={`py-4.5 px-4 first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}
                                                >
                                                    <div>
                                                        <span className="text-base font-medium">{grant.name}</span>
                                                        <span className="block text-sm text-neutral-500 dark:text-neutral-300">{formatCurrency(grant.remainingAmount)} remaining</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell
                                                    className={`py-4.5 px-4 first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}
                                                >
                                                    {formatDate(grant.endDate)}
                                                </TableCell>
                                                <TableCell
                                                    className={`py-4.5 px-4 first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-br-lg" : ""}`}
                                                >
                                                    <Badge variant={statusVariantMap[grant.status] || "default"}>{grant.status}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default MyTasksCard;

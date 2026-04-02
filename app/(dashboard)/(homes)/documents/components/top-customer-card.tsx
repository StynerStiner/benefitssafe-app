"use client";

import { useMemo } from "react";
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

interface Document {
    id: string;
    entityType: string;
    entityId: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    uploadedById: string;
    organizationId: string;
    createdAt: string;
}

const fileTypeLabels: Record<string, string> = {
    receipt: "Receipt",
    invoice: "Invoice",
    contract: "Contract",
    grant_letter: "Grant Agreement",
    report: "Compliance Report",
    tax_form: "Tax Form",
    policy: "Policy Document",
};

const TopCustomerCard = ({ documents }: { documents: Document[] }) => {
    const typeBreakdown = useMemo(() => {
        const counts: Record<string, number> = {};
        documents.forEach((d) => {
            const type = d.fileType || "other";
            counts[type] = (counts[type] || 0) + 1;
        });

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count], index) => ({
                sl: String(index + 1),
                name: fileTypeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1),
                amount: `${count} ${count === 1 ? "file" : "files"}`,
            }));
    }, [documents]);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    {/* Header */}
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h6 className="font-bold text-lg mb-0">Documents by Type</h6>
                            <CommonLink />
                        </div>
                    </div>

                    {/* Users list */}
                    <div className="flex flex-col gap-7 p-6">
                        <Table className="table-auto border-spacing-0 border-separate">
                            <TableHeader>
                                <TableRow className="border-0">
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-[56px] border-t border-neutral-200 dark:border-slate-600 text-start rounded-tl-lg">
                                        SL
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-[56px] border-t border-neutral-200 dark:border-slate-600 text-center">
                                        Name
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-[56px] border-t border-neutral-200 dark:border-slate-600 text-center text-center rounded-tr-lg">
                                        Amount
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {typeBreakdown.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="py-4.5 px-4 text-center text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600">
                                            No documents yet
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    typeBreakdown.map((order, index) => {
                                        const isLast = index === typeBreakdown.length - 1;
                                        return (
                                            <TableRow key={index}>
                                                <TableCell
                                                    className={`py-4.5 px-4 text-neutral-500 dark:text-neutral-200 font-medium first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 text-start ${isLast ? "rounded-bl-lg" : ""
                                                        }`}
                                                >
                                                    {order.sl}
                                                </TableCell>
                                                <TableCell
                                                    className={`py-4.5 px-4 text-neutral-500 dark:text-neutral-200 font-medium first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "" : ""
                                                        }`}
                                                >
                                                    {order.name}
                                                </TableCell>
                                                <TableCell
                                                    className={`py-4.5 px-4 text-neutral-500 dark:text-neutral-200 font-medium first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-br-lg" : ""
                                                        }`}
                                                >
                                                    {order.amount}
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

export default TopCustomerCard;

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
    grant_letter: "Grant Letter",
};

const RecentTransactionsCard = ({ documents }: { documents: Document[] }) => {
    const recentDocs = useMemo(() => {
        return [...documents]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
    }, [documents]);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    {/* Header */}
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h3 className="font-bold text-lg mb-0">Recent Uploads</h3>
                            <CommonLink />
                        </div>
                    </div>

                    <div className="p-6">
                        <Table className="table-auto border-spacing-0 border-separate">
                            <TableHeader>
                                <TableRow className="border-0">
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-start rounded-tl-lg">
                                        SL
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center">
                                        Date Uploaded
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center">
                                        Document Name
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center">
                                        Type
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center text-center rounded-tr-lg">
                                        Entity
                                    </TableHead>
                                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600 text-center text-center rounded-tr-lg">
                                        Entity Type
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentDocs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-4 px-4 text-center text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600">
                                            No documents uploaded yet
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    recentDocs.map((doc, index) => {
                                        const isLast = index === recentDocs.length - 1;
                                        const date = new Date(doc.createdAt);
                                        const formattedDate = date.toLocaleDateString("en-US", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        });
                                        return (
                                            <TableRow key={doc.id}>
                                                <TableCell
                                                    className={`py-4 px-4 first:border-s last:border-e font-medium text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600 text-start ${isLast ? "rounded-bl-lg" : ""}`}
                                                >
                                                    {index + 1}
                                                </TableCell>
                                                <TableCell
                                                    className={`py-4 px-4 first:border-s last:border-e font-medium text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "" : ""}`}
                                                >
                                                    {formattedDate}
                                                </TableCell>
                                                <TableCell
                                                    className={`py-4 px-4 first:border-s last:border-e font-medium text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "" : ""}`}
                                                >
                                                    <div className="text-neutral-600 dark:text-neutral-100">
                                                        {doc.fileName}
                                                    </div>
                                                </TableCell>
                                                <TableCell
                                                    className={`py-4 px-4 first:border-s last:border-e font-medium text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "" : ""}`}
                                                >
                                                    {fileTypeLabels[doc.fileType] || doc.fileType}
                                                </TableCell>
                                                <TableCell
                                                    className={`py-4 px-4 first:border-s last:border-e font-medium text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "" : ""}`}
                                                >
                                                    {doc.entityId.slice(0, 8)}...
                                                </TableCell>
                                                <TableCell
                                                    className={`py-4 px-4 first:border-s last:border-e font-medium text-neutral-500 dark:text-neutral-200 border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-br-lg" : ""}`}
                                                >
                                                    {doc.entityType.charAt(0).toUpperCase() + doc.entityType.slice(1)}
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

export default RecentTransactionsCard;

"use client";

import { Card, CardContent } from '@/components/ui/card';
import CustomSelect from '@/components/shared/custom-select';
import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface TransactionData {
    id: string;
    amount: string;
    merchantName: string;
    merchantCategory: string | null;
    createdAt: string;
}

function filterByPeriod<T extends { createdAt: string }>(items: T[], period: string): T[] {
  const now = new Date();
  return items.filter(item => {
    const date = new Date(item.createdAt);
    switch (period) {
      case "Today": return date.toDateString() === now.toDateString();
      case "Weekly": return now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
      case "Monthly": return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      case "Yearly": return date.getFullYear() === now.getFullYear();
      default: return true;
    }
  });
}

const MyOrderCard = ({ transactions }: { transactions: TransactionData[] }) => {
    const [period, setPeriod] = useState("Yearly");
    const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set(transactions.map((t) => t.id)));

    const removeOrderItem = (id: string) => {
        setVisibleIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        toast.success("Table Row has been deleted!");
    };

    const visibleTransactions = filterByPeriod(transactions, period).filter((t) => visibleIds.has(t.id));

    return (
        <Card className="card h-full rounded-lg border-0">
            <CardContent className="card-body p-0">
                <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
                    <h3 className="mb-0 font-bold text-lg">Recent Transactions</h3>

                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                        value={period}
                        onValueChange={setPeriod}
                    />
                </div>

                <Table className="table-auto border-spacing-0 border-separate">
                    <TableHeader>
                        <TableRow className="border-0">
                            <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base border-t border-neutral-200 dark:border-slate-600 px-4 h-12 border-s rounded-tl-lg">
                                Date
                            </TableHead>
                            <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base border-t border-neutral-200 dark:border-slate-600 px-4 h-12">
                                Amount
                            </TableHead>
                            <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base border-t border-neutral-200 dark:border-slate-600 px-4 h-12 text-center">
                                Merchant
                            </TableHead>
                            <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base border-t border-neutral-200 dark:border-slate-600 px-4 h-12 border-e rounded-tr-lg text-center">
                                Action
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {visibleTransactions.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className={`py-3.5 px-4 border border-neutral-200 dark:border-slate-600 text-base  rounded-bl-lg rounded-br-lg text-center`}
                                >
                                    <span className="text-sm text-neutral-900 dark:text-white font-semibold">
                                        No Data Available
                                    </span>
                                </TableCell>
                            </TableRow>
                        ) : (
                            <>
                                {visibleTransactions.map((txn, index) => {
                                    const isLastRow = index === visibleTransactions.length - 1;
                                    const amt = parseFloat(txn.amount);
                                    const formattedAmount = amt.toLocaleString("en-US", { style: "currency", currency: "USD" });
                                    const dateStr = new Date(txn.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

                                    return (
                                        <TableRow key={txn.id}>
                                            <TableCell
                                                className={`py-3.5 px-4 border-b border-neutral-200 dark:border-slate-600 text-base first:border-s last:border-e ${
                                                    isLastRow ? "rounded-bl-lg" : ""
                                                }`}
                                            >
                                                <span className="text-red-600">
                                                    {dateStr}
                                                </span>
                                            </TableCell>

                                            <TableCell
                                                className={`py-3.5 px-4 border-b border-neutral-200 dark:border-slate-600 text-base first:border-s last:border-e ${
                                                    isLastRow ? "rounded-bl-lg" : ""
                                                }`}
                                            >
                                                {formattedAmount}
                                            </TableCell>

                                            <TableCell
                                                className={`py-3.5 px-4 border-b border-neutral-200 dark:border-slate-600 text-base text-center first:border-s last:border-e ${
                                                    isLastRow ? "rounded-bl-lg" : ""
                                                }`}
                                            >
                                                {txn.merchantName}
                                            </TableCell>

                                            <TableCell
                                                className={`py-3.5 px-4 border-b border-neutral-200 dark:border-slate-600 text-base first:border-s last:border-e text-center ${
                                                    isLastRow ? "rounded-br-lg" : ""
                                                }`}
                                            >
                                                <Button
                                                    variant="link"
                                                    className={cn(
                                                        `text-lg text-red-600 dark:text-red-500 cursor-pointer hover:scale-150`
                                                    )}
                                                    onClick={() => removeOrderItem(txn.id)}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </>
                        )}
                    </TableBody>
                </Table>

            </CardContent>
        </Card>
    );
};

export default MyOrderCard;
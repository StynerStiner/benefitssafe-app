"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { SquarePen, Trash } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../ui/button";

interface ExpenseTransaction {
    id: string;
    description: string;
    amount: string;
    status: string;
    createdAt: string;
    requestedBy: {
        id: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
    };
    vendor?: {
        id: string;
        name: string;
        type: string;
    };
    virtualCard?: {
        id: string;
        last4: string;
    } | null;
}

const RecentBidTable = () => {
    const [transactions, setTransactions] = useState<ExpenseTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/expenses?limit=7")
            .then((r) => r.ok ? r.json() : { data: [] })
            .then((json) => {
                const items = Array.isArray(json) ? json : json.data;
                if (Array.isArray(items)) {
                    setTransactions(items.slice(0, 7));
                }
            })
            .catch(() => setTransactions([]))
            .finally(() => setLoading(false));
    }, []);

    const handleRemove = (id: string) => {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        toast.success('Transaction deleted successfully!')
    }

    if (loading) {
        return <div className="text-center py-8">Loading transactions...</div>;
    }

    if (transactions.length === 0) {
        return <div className="text-center py-8 text-neutral-500">No transactions yet</div>;
    }

    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow className="border-0">
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 border-t border-s border-neutral-200 dark:border-slate-600 text-start rounded-tl-lg">
                        Transaction
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600">
                        Amount
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600">
                        Merchant
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600">
                        Card
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600">
                        Date
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 border-t border-e border-neutral-200 dark:border-slate-600 text-center rounded-tr-lg">
                        Action
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {transactions.map((tx, index) => {
                    const isLast = index === transactions.length - 1;
                    const initials = `${tx.requestedBy.firstName?.[0] || '?'}${tx.requestedBy.lastName?.[0] || '?'}`;
                    const cardLast4 = tx.virtualCard?.last4 || "N/A";
                    
                    return (
                        <TableRow key={tx.id}>
                            <TableCell
                                className={`py-3 px-4 first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 text-start ${isLast ? "rounded-bl-lg" : ""}`}
                            >
                                <div className="flex items-center">
                                    {tx.requestedBy.avatarUrl ? (
                                        <Image
                                            src={tx.requestedBy.avatarUrl}
                                            alt={`${tx.requestedBy.firstName} ${tx.requestedBy.lastName}`}
                                            width={40}
                                            height={40}
                                            className="flex-shrink-0 w-10 h-10 rounded-full me-3 object-cover"
                                        />
                                    ) : (
                                        <div className="flex-shrink-0 w-10 h-10 rounded-full me-3 bg-primary text-white flex items-center justify-center text-sm font-semibold">
                                            {initials}
                                        </div>
                                    )}
                                    <div className="flex-grow">
                                        <h6 className="text-base mb-0 font-semibold">
                                            {tx.description}
                                        </h6>
                                        <span className="text-sm text-neutral-500 dark:text-neutral-300 font-normal">
                                            {tx.requestedBy.firstName} {tx.requestedBy.lastName}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>

                            <TableCell className="py-3 px-4 border-b border-neutral-200 dark:border-slate-600">
                                ${parseFloat(tx.amount).toFixed(2)}
                            </TableCell>

                            <TableCell className="py-3 px-4 border-b border-neutral-200 dark:border-slate-600">
                                {tx.vendor?.name || "—"}
                            </TableCell>

                            <TableCell className="py-3 px-4 border-b border-neutral-200 dark:border-slate-600">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full me-3 bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-sm font-semibold">
                                        {cardLast4 !== "N/A" ? cardLast4 : "—"}
                                    </div>
                                    <div className="flex-grow">
                                        <h6 className="text-base mb-0 font-semibold text-[#0a0a0a] dark:text-white">
                                            {cardLast4}
                                        </h6>
                                    </div>
                                </div>
                            </TableCell>

                            <TableCell className="py-3 px-4 border-b border-neutral-200 dark:border-slate-600">
                                {new Date(tx.createdAt).toLocaleDateString()}
                            </TableCell>

                            <TableCell className={`py-3 px-4 border-b border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-br-lg" : ""}`}>
                                <div className="flex justify-center gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="p-0 h-auto"
                                    >
                                        <SquarePen className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="p-0 h-auto"
                                        onClick={() => handleRemove(tx.id)}
                                    >
                                        <Trash className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
};

export default RecentBidTable;

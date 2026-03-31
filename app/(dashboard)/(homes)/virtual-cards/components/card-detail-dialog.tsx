"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { CreditCard, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface VirtualCard {
    id: string;
    last4: string;
    spendingCap: string | null;
    spendingLimit?: string | number;
    cardType: string;
    status: string;
    createdAt: string;
    beneficiary?: {
        id: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
    } | null;
    vendor: { id: string; name: string; type: string } | null;
    expense: { id: string; description: string; amount: string } | null;
}

interface StatementTransaction {
    id: string;
    date: string;
    merchant: string;
    category: string;
    amount: number;
    status: string;
}

interface StatementData {
    period: { month: string };
    card: {
        last4: string;
        type: string;
        status: string;
        expiresAt: string;
        spendingLimit: number;
    };
    beneficiary: {
        name: string;
        email: string;
    } | null;
    transactions: StatementTransaction[];
    summary: {
        totalTransactions: number;
        approvedCount: number;
        declinedCount: number;
        approvedTotal: number;
        declinedTotal: number;
        remainingBalance: number;
    };
}

interface CardDetailDialogProps {
    card: VirtualCard | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function getStatusVariant(status: string) {
    switch (status?.toUpperCase()) {
        case "ACTIVE":
            return "success";
        case "FROZEN":
            return "warning";
        case "CANCELLED":
            return "danger";
        default:
            return "secondary";
    }
}

function getTransactionStatusVariant(status: string) {
    switch (status?.toLowerCase()) {
        case "approved":
            return "success";
        case "declined":
            return "danger";
        case "disputed":
            return "warning";
        default:
            return "secondary";
    }
}

const CardDetailDialog = ({ card, open, onOpenChange }: CardDetailDialogProps) => {
    const [statement, setStatement] = useState<StatementData | null>(null);
    const [loadingStatement, setLoadingStatement] = useState(false);
    const [statementError, setStatementError] = useState<string | null>(null);

    useEffect(() => {
        if (open && card) {
            setLoadingStatement(true);
            setStatementError(null);
            fetch(`/api/virtual-cards/${card.id}/statement`)
                .then((r) => {
                    if (!r.ok) throw new Error("Failed to load statement");
                    return r.json();
                })
                .then((data: StatementData) => setStatement(data))
                .catch(() => setStatementError("Unable to load statement data."))
                .finally(() => setLoadingStatement(false));
        } else {
            setStatement(null);
            setStatementError(null);
        }
    }, [open, card]);

    if (!card) return null;

    const beneficiaryName = card.beneficiary
        ? `${card.beneficiary.firstName} ${card.beneficiary.lastName}`
        : "No Beneficiary";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="size-5" />
                        Card Details - **** {card.last4}
                    </DialogTitle>
                    <DialogDescription>
                        Virtual card information and transaction history
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Card Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-300">Card Number</p>
                            <p className="text-sm font-semibold">**** **** **** {card.last4}</p>
                        </div>
                        <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-300">Status</p>
                            <Badge variant={getStatusVariant(card.status)}>
                                {card.status}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-300">Spending Cap</p>
                            <p className="text-sm font-semibold">${card.spendingCap || "0"}</p>
                        </div>
                        <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-300">Beneficiary</p>
                            <p className="text-sm font-semibold">{beneficiaryName}</p>
                        </div>
                        <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-300">Vendor</p>
                            <p className="text-sm font-semibold">{card.vendor?.name || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-300">Created</p>
                            <p className="text-sm font-semibold">
                                {card.createdAt
                                    ? new Date(card.createdAt).toLocaleDateString("en-US", {
                                          year: "numeric",
                                          month: "short",
                                          day: "numeric",
                                      })
                                    : "N/A"}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-300">Card Type</p>
                            <p className="text-sm font-semibold">{card.cardType || "Virtual"}</p>
                        </div>
                        {card.expense && (
                            <div>
                                <p className="text-sm text-neutral-500 dark:text-neutral-300">Expense</p>
                                <p className="text-sm font-semibold">{card.expense.description}</p>
                            </div>
                        )}
                    </div>

                    {/* Statement / Transactions */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <FileText className="size-4" />
                            <h6 className="text-base font-semibold">
                                Transaction History
                                {statement?.period?.month ? ` - ${statement.period.month}` : ""}
                            </h6>
                        </div>

                        {loadingStatement && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="size-5 animate-spin text-neutral-400" />
                                <span className="ml-2 text-sm text-neutral-500">Loading transactions...</span>
                            </div>
                        )}

                        {statementError && (
                            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                <p className="text-sm text-red-600 dark:text-red-400">{statementError}</p>
                            </div>
                        )}

                        {statement && !loadingStatement && (
                            <>
                                {/* Summary */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                                        <p className="text-xs text-neutral-500 dark:text-neutral-300">Approved</p>
                                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                                            ${statement.summary.approvedTotal.toFixed(2)}
                                        </p>
                                        <p className="text-xs text-neutral-400">
                                            {statement.summary.approvedCount} transactions
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                                        <p className="text-xs text-neutral-500 dark:text-neutral-300">Declined</p>
                                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                                            ${statement.summary.declinedTotal.toFixed(2)}
                                        </p>
                                        <p className="text-xs text-neutral-400">
                                            {statement.summary.declinedCount} transactions
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                        <p className="text-xs text-neutral-500 dark:text-neutral-300">Remaining</p>
                                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                            ${statement.summary.remainingBalance.toFixed(2)}
                                        </p>
                                        <p className="text-xs text-neutral-400">of cap</p>
                                    </div>
                                </div>

                                {/* Transaction List */}
                                {statement.transactions.length > 0 ? (
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-neutral-50 dark:bg-slate-700">
                                                    <th className="text-left p-2 font-medium text-neutral-500 dark:text-neutral-300">Date</th>
                                                    <th className="text-left p-2 font-medium text-neutral-500 dark:text-neutral-300">Merchant</th>
                                                    <th className="text-right p-2 font-medium text-neutral-500 dark:text-neutral-300">Amount</th>
                                                    <th className="text-center p-2 font-medium text-neutral-500 dark:text-neutral-300">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {statement.transactions.map((txn) => (
                                                    <tr
                                                        key={txn.id}
                                                        className="border-t border-neutral-100 dark:border-slate-600"
                                                    >
                                                        <td className="p-2 text-neutral-600 dark:text-neutral-300">
                                                            {txn.date}
                                                        </td>
                                                        <td className="p-2 text-neutral-800 dark:text-neutral-200">
                                                            {txn.merchant || "Unknown"}
                                                        </td>
                                                        <td className="p-2 text-right font-medium">
                                                            ${txn.amount.toFixed(2)}
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <Badge variant={getTransactionStatusVariant(txn.status)}>
                                                                {txn.status}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-neutral-500 dark:text-neutral-300 py-4 text-center">
                                        No transactions this period.
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CardDetailDialog;

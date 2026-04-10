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
import { Copy, CreditCard, Eye, EyeOff, FileText, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

interface VirtualCard {
    id: string;
    last4: string;
    spendingCap: string | null;
    spendingLimit?: string | number;
    cardType: string;
    status: string;
    createdAt: string;
    expirationMonth?: number;
    expirationYear?: number;
    beneficiary?: {
        id: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
    } | null;
    vendor: { id: string; name: string; type: string } | null;
    expense: { id: string; description: string; amount: string } | null;
}

interface RevealedCardMock {
    number: string;
    cvc: string;
    expMonth: number;
    expYear: number;
    cardholderName: string;
    brand: string;
    spendingCap: number | null;
    merchantLock: string | null;
    status: string;
}

interface RevealedCardEphemeral {
    ephemeralKey: string;
    stripeCardId: string;
    cardholderName: string;
    brand: string;
    expMonth: number;
    expYear: number;
    spendingCap: number | null;
    merchantLock: string | null;
    status: string;
}

type RevealedCard = RevealedCardMock | RevealedCardEphemeral;

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

    const [revealed, setRevealed] = useState<RevealedCard | null>(null);
    const [revealing, setRevealing] = useState(false);
    const [showNumber, setShowNumber] = useState(false);
    const [isMockCard, setIsMockCard] = useState(false);
    const stripeCardElementRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (open && card) {
            setLoadingStatement(true);
            setStatementError(null);
            setRevealed(null);
            setShowNumber(false);
            setIsMockCard(false);
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
            setRevealed(null);
            setShowNumber(false);
            setIsMockCard(false);
        }
    }, [open, card]);

    const mountStripeElements = useCallback(async (ephemeralKey: string, stripeCardId: string) => {
        try {
            const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
            if (!publishableKey) {
                toast.error("Stripe publishable key is not configured");
                return;
            }
            const { loadStripe } = await import("@stripe/stripe-js");
            const stripeInstance = await loadStripe(publishableKey);
            if (!stripeInstance) {
                toast.error("Failed to load Stripe");
                return;
            }
            const elements = stripeInstance.elements({
                clientSecret: ephemeralKey,
            });
            const issuingCardNumberDisplay = elements.create("issuingCardNumberDisplay" as never, {
                issuingCard: stripeCardId,
                nonce: ephemeralKey,
                style: {
                    base: {
                        color: "#ffffff",
                        fontSize: "20px",
                        fontFamily: "monospace",
                        letterSpacing: "0.1em",
                    },
                },
            } as never);
            const issuingCardCvcDisplay = elements.create("issuingCardCvcDisplay" as never, {
                issuingCard: stripeCardId,
                nonce: ephemeralKey,
                style: {
                    base: {
                        color: "#ffffff",
                        fontSize: "14px",
                        fontFamily: "monospace",
                    },
                },
            } as never);
            // Mount number element
            const numberContainer = document.getElementById("stripe-card-number-container");
            if (numberContainer) {
                numberContainer.innerHTML = "";
                (issuingCardNumberDisplay as unknown as { mount: (el: HTMLElement) => void }).mount(numberContainer);
            }
            // Mount CVC element
            const cvcContainer = document.getElementById("stripe-card-cvc-container");
            if (cvcContainer) {
                cvcContainer.innerHTML = "";
                (issuingCardCvcDisplay as unknown as { mount: (el: HTMLElement) => void }).mount(cvcContainer);
            }
        } catch (err) {
            console.error("Stripe Elements mount error:", err);
            toast.error("Failed to display card details securely");
        }
    }, []);

    const handleReveal = async () => {
        if (!card) return;
        setRevealing(true);
        try {
            const res = await fetch(`/api/virtual-cards/${card.id}/reveal`);
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || "Failed to reveal card details");
                return;
            }
            const data = await res.json();
            setRevealed(data);
            setShowNumber(true);

            // Check if this is a mock card (has number field) vs real card (has ephemeralKey)
            if ("number" in data && data.number) {
                setIsMockCard(true);
            } else if ("ephemeralKey" in data && data.ephemeralKey) {
                setIsMockCard(false);
                // Defer Stripe Elements mounting to next tick so containers are rendered
                setTimeout(() => {
                    mountStripeElements(data.ephemeralKey, data.stripeCardId);
                }, 100);
            }
        } catch {
            toast.error("Something went wrong");
        } finally {
            setRevealing(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text.replace(/\s/g, ""));
        toast.success(`${label} copied`);
    };

    if (!card) return null;

    const beneficiaryName = card.beneficiary
        ? `${card.beneficiary.firstName} ${card.beneficiary.lastName}`
        : "No Beneficiary";

    const displayExpMonth = revealed?.expMonth || card.expirationMonth || 12;
    const displayExpYear = revealed?.expYear || card.expirationYear || 2027;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="size-5" />
                        Virtual Card
                    </DialogTitle>
                    <DialogDescription>
                        {card.status === "ACTIVE" ? "This card is active and ready for online purchases" : `Card status: ${card.status}`}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Visual Card */}
                    <div className="relative rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-white p-6 shadow-lg overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -mr-10 -mt-10" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 -ml-8 -mb-8" />

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-sm font-medium text-white/70">BenefitsSafe</span>
                                <Badge variant={getStatusVariant(card.status)} className="text-xs">
                                    {card.status}
                                </Badge>
                            </div>

                            {/* Card Number */}
                            <div className="mb-6">
                                <p className="text-xs text-white/50 mb-1">Card Number</p>
                                <div className="flex items-center gap-3">
                                    {showNumber && revealed && isMockCard ? (
                                        <>
                                            <p className="text-xl font-mono tracking-widest">
                                                {"number" in revealed ? revealed.number : `**** **** **** ${card.last4}`}
                                            </p>
                                            {"number" in revealed && (
                                                <button
                                                    onClick={() => copyToClipboard(revealed.number, "Card number")}
                                                    className="p-1 rounded hover:bg-white/10 transition-colors"
                                                >
                                                    <Copy className="w-4 h-4 text-white/60" />
                                                </button>
                                            )}
                                        </>
                                    ) : showNumber && revealed && !isMockCard ? (
                                        <div className="flex items-center gap-2">
                                            <div id="stripe-card-number-container" ref={stripeCardElementRef} className="min-w-[240px] min-h-[28px]" />
                                            <ShieldCheck className="w-4 h-4 text-green-300" />
                                        </div>
                                    ) : (
                                        <p className="text-xl font-mono tracking-widest">
                                            **** **** **** {card.last4}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                {/* Cardholder Name */}
                                <div className="col-span-1">
                                    <p className="text-xs text-white/50 mb-1">Cardholder</p>
                                    <p className="text-sm font-semibold truncate">
                                        {revealed?.cardholderName || beneficiaryName}
                                    </p>
                                </div>

                                {/* Expiration */}
                                <div>
                                    <p className="text-xs text-white/50 mb-1">Expires</p>
                                    <p className="text-sm font-mono font-semibold">
                                        {String(displayExpMonth).padStart(2, "0")}/{String(displayExpYear).slice(-2)}
                                    </p>
                                </div>

                                {/* CVC */}
                                <div>
                                    <p className="text-xs text-white/50 mb-1">CVC</p>
                                    <div className="flex items-center gap-2">
                                        {showNumber && revealed && isMockCard && "cvc" in revealed ? (
                                            <>
                                                <p className="text-sm font-mono font-semibold">
                                                    {revealed.cvc}
                                                </p>
                                                <button
                                                    onClick={() => copyToClipboard(revealed.cvc, "CVC")}
                                                    className="p-0.5 rounded hover:bg-white/10 transition-colors"
                                                >
                                                    <Copy className="w-3 h-3 text-white/60" />
                                                </button>
                                            </>
                                        ) : showNumber && revealed && !isMockCard ? (
                                            <div id="stripe-card-cvc-container" className="min-w-[40px] min-h-[20px]" />
                                        ) : (
                                            <p className="text-sm font-mono font-semibold">***</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Spending Cap */}
                            {card.spendingCap && (
                                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Lock className="w-3.5 h-3.5 text-white/50" />
                                        <span className="text-xs text-white/50">Spending Limit</span>
                                    </div>
                                    <span className="text-sm font-semibold">
                                        ${parseFloat(card.spendingCap).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Reveal / Hide Button */}
                    {card.status === "ACTIVE" && (
                        <div className="flex gap-3">
                            {!showNumber ? (
                                <Button
                                    onClick={handleReveal}
                                    disabled={revealing}
                                    className="flex-1 h-11"
                                >
                                    {revealing ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Eye className="w-4 h-4 mr-2" />
                                    )}
                                    {revealing ? "Revealing..." : "Show Full Card Details"}
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={() => { setShowNumber(false); setRevealed(null); }}
                                    className="flex-1 h-11"
                                >
                                    <EyeOff className="w-4 h-4 mr-2" />
                                    Hide Card Details
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Card Info Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-300">Vendor</p>
                            <p className="text-sm font-semibold">{card.vendor?.name || "Any merchant"}</p>
                        </div>
                        <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-300">Card Type</p>
                            <p className="text-sm font-semibold capitalize">{card.cardType?.replace("_", " ") || "Virtual"}</p>
                        </div>
                        <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-300">Created</p>
                            <p className="text-sm font-semibold">
                                {new Date(card.createdAt).toLocaleDateString("en-US", {
                                    year: "numeric", month: "short", day: "numeric",
                                })}
                            </p>
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
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                                        <p className="text-xs text-neutral-500 dark:text-neutral-300">Approved</p>
                                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">
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
                                    <div className="border rounded-lg overflow-x-auto">
                                        <table className="w-full text-sm min-w-[500px]">
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
                                                    <tr key={txn.id} className="border-t border-neutral-100 dark:border-slate-600">
                                                        <td className="p-2 text-neutral-600 dark:text-neutral-300">{txn.date}</td>
                                                        <td className="p-2 text-neutral-800 dark:text-neutral-200">{txn.merchant || "Unknown"}</td>
                                                        <td className="p-2 text-right font-medium">${txn.amount.toFixed(2)}</td>
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
                                        No transactions yet
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

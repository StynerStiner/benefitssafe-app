"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import { Pause, Play, XCircle } from "lucide-react";

interface Subscription {
    id: string;
    serviceName: string;
    monthlyCost: string;
    status: string;
    renewalDate: string | null;
    vendor: { name: string } | null;
}

const statusStyles: Record<string, string> = {
    ACTIVE: "text-green-600 bg-green-100 dark:bg-green-600/25",
    PAUSED: "text-yellow-600 bg-yellow-100 dark:bg-yellow-600/25",
    CANCELLED: "text-red-600 bg-red-100 dark:bg-red-600/25",
    PENDING: "text-yellow-600 bg-yellow-100 dark:bg-yellow-600/25",
    EXPIRED: "text-neutral-600 bg-neutral-100 dark:bg-neutral-600/25",
};

const formatRenewalDate = (d: string | null) => {
    if (!d) return null;
    const date = new Date(d);
    return `Renewing ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
};

const formatShortDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "-";

interface TransactionHistoryCardProps {
    subscriptions: Subscription[];
    onStatusChange?: (id: string, newStatus: string) => void;
}

const TransactionHistoryCard = ({ subscriptions, onStatusChange }: TransactionHistoryCardProps) => {
    const recent = subscriptions.slice(0, 6);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleStatusChange = async (id: string, newStatus: string) => {
        setLoadingId(id);
        try {
            const res = await fetch(`/api/subscriptions/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || "Failed to update subscription");
                return;
            }

            const label =
                newStatus === "PAUSED"
                    ? "paused"
                    : newStatus === "ACTIVE"
                        ? "resumed"
                        : "cancelled";
            toast.success(`Subscription ${label} successfully`);

            if (onStatusChange) {
                onStatusChange(id, newStatus);
            }
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Subscription List</h6>
                    <CommonLink />
                </div>
                <div className="card-body">
                    {recent.length === 0 ? (
                        <p className="text-sm text-neutral-500">No subscriptions</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {recent.map((sub) => {
                                const isLoading = loadingId === sub.id;
                                const renewal = formatRenewalDate(sub.renewalDate);

                                return (
                                    <div key={sub.id} className="flex items-center justify-between">
                                        <div>
                                            <h6 className="text-sm font-medium mb-0">{sub.serviceName}</h6>
                                            <span className="text-xs text-neutral-500 dark:text-neutral-300">
                                                {sub.vendor?.name || "Unknown"} - Next: {formatShortDate(sub.renewalDate)}
                                            </span>
                                            {renewal && (
                                                <span className="text-xs text-neutral-400 dark:text-neutral-400 block">
                                                    {renewal}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-end">
                                                <span className="text-sm font-semibold">
                                                    ${parseFloat(sub.monthlyCost || "0").toFixed(2)}
                                                </span>
                                                <span
                                                    className={`text-xs py-0.5 px-2 rounded-full ml-2 font-medium ${statusStyles[sub.status] || statusStyles.PENDING}`}
                                                >
                                                    {sub.status}
                                                </span>
                                            </div>

                                            {/* Action buttons */}
                                            {sub.status === "ACTIVE" && (
                                                <div className="flex items-center gap-1 ml-2">
                                                    <button
                                                        type="button"
                                                        disabled={isLoading}
                                                        onClick={() => handleStatusChange(sub.id, "PAUSED")}
                                                        className="p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-600/20 text-yellow-600 transition-colors disabled:opacity-50"
                                                        title="Pause subscription"
                                                    >
                                                        <Pause className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isLoading}
                                                        onClick={() => handleStatusChange(sub.id, "CANCELLED")}
                                                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-600/20 text-red-600 transition-colors disabled:opacity-50"
                                                        title="Cancel subscription"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}

                                            {sub.status === "PAUSED" && (
                                                <div className="flex items-center gap-1 ml-2">
                                                    <button
                                                        type="button"
                                                        disabled={isLoading}
                                                        onClick={() => handleStatusChange(sub.id, "ACTIVE")}
                                                        className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-600/20 text-green-600 transition-colors disabled:opacity-50"
                                                        title="Resume subscription"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isLoading}
                                                        onClick={() => handleStatusChange(sub.id, "CANCELLED")}
                                                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-600/20 text-red-600 transition-colors disabled:opacity-50"
                                                        title="Cancel subscription"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}

                                            {sub.status === "CANCELLED" && (
                                                <span className="text-xs py-0.5 px-2 rounded-full font-medium text-red-600 bg-red-100 dark:bg-red-600/25 ml-2">
                                                    Cancelled
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default TransactionHistoryCard;

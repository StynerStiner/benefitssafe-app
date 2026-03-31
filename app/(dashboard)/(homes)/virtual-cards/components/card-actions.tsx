"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pause, X } from "lucide-react";
import { useState } from "react";

interface CardActionsProps {
    cardId: string;
    cardLast4: string;
    status: string;
    onActionComplete: () => void;
}

const CardActions = ({ cardId, cardLast4, status, onActionComplete }: CardActionsProps) => {
    const [confirmClose, setConfirmClose] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const normalizedStatus = status?.toUpperCase();
    const isActive = normalizedStatus === "ACTIVE";
    const isFrozen = normalizedStatus === "FROZEN";
    const isCancelled = normalizedStatus === "CANCELLED";

    if (isCancelled) return null;

    const handlePause = async () => {
        setLoading("pause");
        setError(null);
        try {
            const res = await fetch(`/api/virtual-cards/${cardId}/pause`, {
                method: "POST",
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: "Failed to pause card" }));
                throw new Error(data.error || "Failed to pause card");
            }
            onActionComplete();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to pause card";
            setError(message);
        } finally {
            setLoading(null);
        }
    };

    const handleClose = async () => {
        setLoading("close");
        setError(null);
        try {
            const res = await fetch(`/api/virtual-cards/${cardId}/close`, {
                method: "POST",
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: "Failed to close card" }));
                throw new Error(data.error || "Failed to close card");
            }
            setConfirmClose(false);
            onActionComplete();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to close card";
            setError(message);
        } finally {
            setLoading(null);
        }
    };

    return (
        <>
            <div className="flex items-center gap-1">
                {isActive && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePause}
                        disabled={loading !== null}
                        title="Pause card"
                    >
                        {loading === "pause" ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Pause className="size-4" />
                        )}
                    </Button>
                )}

                {isFrozen && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 px-2">
                        Paused
                    </span>
                )}

                {(isActive || isFrozen) && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmClose(true)}
                        disabled={loading !== null}
                        title="Close card"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        {loading === "close" ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <X className="size-4" />
                        )}
                    </Button>
                )}
            </div>

            {error && (
                <p className="text-xs text-red-500 mt-1">{error}</p>
            )}

            {/* Close Confirmation Dialog */}
            <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Close Card **** {cardLast4}</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to close this card? This action cannot be undone.
                            The card will be permanently cancelled and no further transactions will be allowed.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmClose(false)}
                            disabled={loading !== null}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleClose}
                            disabled={loading !== null}
                        >
                            {loading === "close" ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Closing...
                                </>
                            ) : (
                                "Close Card"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default CardActions;

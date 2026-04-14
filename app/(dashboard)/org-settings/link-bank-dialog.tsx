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
import { Loader2, Landmark } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

interface LinkBankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}

export function LinkBankDialog({ open, onOpenChange, onLinked }: LinkBankDialogProps) {
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elementsRef = useRef<{ elements: unknown; stripeInstance: unknown; clientSecret: string } | null>(null);

  useEffect(() => {
    if (!open) {
      elementsRef.current = null;
      setError(null);
      setLoading(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/org/link-bank", { method: "POST" });
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok || !data.clientSecret || !data.stripeAccountId) {
          setError(data.error || "Failed to start bank link");
          setLoading(false);
          return;
        }

        const publishableKey =
          data.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!publishableKey) {
          setError("Stripe publishable key is not configured");
          setLoading(false);
          return;
        }

        const { loadStripe } = await import("@stripe/stripe-js");
        const stripeInstance = await loadStripe(publishableKey, {
          stripeAccount: data.stripeAccountId,
        });
        if (cancelled) return;

        if (!stripeInstance) {
          setError("Failed to load Stripe");
          setLoading(false);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const elements = (stripeInstance as any).elements({
          clientSecret: data.clientSecret,
          appearance: { theme: "stripe" },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const paymentElement = elements.create("payment", {
          paymentMethodOrder: ["us_bank_account"],
        });

        // Wait one tick so the DialogContent has mounted the target div
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        if (cancelled) return;

        paymentElement.mount("#link-bank-element");

        elementsRef.current = {
          elements,
          stripeInstance,
          clientSecret: data.clientSecret,
        };
        setLoading(false);
      } catch (err) {
        console.error("[link-bank] init failed:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to initialize bank link");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleConfirm = async () => {
    if (!elementsRef.current) return;
    setConfirming(true);
    setError(null);

    try {
      const { elements, stripeInstance, clientSecret } = elementsRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const submitResult = await (elements as any).submit();
      if (submitResult?.error) {
        setError(submitResult.error.message || "Please complete the form");
        setConfirming(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: confirmError, setupIntent } = await (stripeInstance as any).confirmSetup({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/org-settings`,
        },
        redirect: "if_required",
      });

      if (confirmError) {
        setError(confirmError.message || "Bank link failed");
        setConfirming(false);
        return;
      }

      const paymentMethodId = setupIntent?.payment_method;
      if (!paymentMethodId || typeof paymentMethodId !== "string") {
        setError("Setup succeeded but no payment method id returned");
        setConfirming(false);
        return;
      }

      const patchRes = await fetch("/api/org/link-bank", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
      });
      const patchData = await patchRes.json();

      if (!patchRes.ok) {
        setError(patchData.error || "Failed to save bank link");
        setConfirming(false);
        return;
      }

      toast.success(
        `Bank linked${patchData.bankName ? ` — ${patchData.bankName}` : ""}${patchData.last4 ? ` ••${patchData.last4}` : ""}`,
      );
      onLinked();
      onOpenChange(false);
    } catch (err) {
      console.error("[link-bank] confirm failed:", err);
      setError(err instanceof Error ? err.message : "Failed to confirm bank link");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            Link Funding Bank Account
          </DialogTitle>
          <DialogDescription>
            Securely link your nonprofit's bank account. This is the account
            that funds your Treasury balance for virtual card issuance.
            Stripe hosts the collection form — your credentials never touch
            our servers.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          )}
          <div
            id="link-bank-element"
            className={loading ? "hidden" : "min-h-[220px]"}
          />
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading || confirming}>
            {confirming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Landmark className="w-4 h-4" />
            )}
            Link Bank Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

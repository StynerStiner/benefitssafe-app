"use client";

import { useState, useEffect, useCallback } from "react";

interface VirtualCardOption {
  id: string;
  last4: string;
  spendingCap: string | null;
  status: string;
  cardLabel: string | null;
}

interface CardLinkSectionProps {
  subscriptionId: string;
  grantId: string;
  currentCardId: string | null;
  currentCard: { id: string; last4: string; status: string; cardLabel: string | null } | null;
  billingUpdateStatus: string;
  onUpdate?: () => void;
}

const BILLING_STEPS = [
  { key: "PENDING", label: "Pending" },
  { key: "CARD_ISSUED", label: "Card Issued" },
  { key: "CARD_SHARED", label: "Card Shared" },
  { key: "UPDATED", label: "Billing Updated" },
  { key: "VERIFIED", label: "Verified" },
] as const;

export default function CardLinkSection({
  subscriptionId,
  grantId,
  currentCardId,
  currentCard,
  billingUpdateStatus,
  onUpdate,
}: CardLinkSectionProps) {
  const [cards, setCards] = useState<VirtualCardOption[]>([]);
  const [selectedCardId, setSelectedCardId] = useState(currentCardId ?? "");
  const [currentStatus, setCurrentStatus] = useState(billingUpdateStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fetch available cards for this grant
  useEffect(() => {
    if (!grantId) return;
    fetch(`/api/virtual-cards?grantId=${grantId}&status=ACTIVE&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setCards(data.data);
      })
      .catch(() => {});
  }, [grantId]);

  const updateSubscription = useCallback(
    async (data: Record<string, string | null>) => {
      setSaving(true);
      setError("");
      try {
        const res = await fetch(`/api/subscriptions/${subscriptionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update");
        }
        const updated = await res.json();
        if (updated.billingUpdateStatus) {
          setCurrentStatus(updated.billingUpdateStatus);
        }
        onUpdate?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      } finally {
        setSaving(false);
      }
    },
    [subscriptionId, onUpdate]
  );

  const handleCardLink = () => {
    if (!selectedCardId) return;
    updateSubscription({ cardId: selectedCardId });
  };

  const handleUnlink = () => {
    setSelectedCardId("");
    updateSubscription({ cardId: null });
  };

  const advanceStatus = (nextStatus: string) => {
    updateSubscription({ billingUpdateStatus: nextStatus });
  };

  const currentStepIndex = BILLING_STEPS.findIndex((s) => s.key === currentStatus);
  const nextStep = currentStepIndex < BILLING_STEPS.length - 1
    ? BILLING_STEPS[currentStepIndex + 1]
    : null;

  return (
    <div className="space-y-6">
      {/* Card Linking */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Linked Virtual Card</h3>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>
        )}

        {currentCard ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
            <div className="flex-1">
              <p className="text-sm font-medium">
                **** {currentCard.last4}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {currentCard.cardLabel || "Virtual Card"} &middot; {currentCard.status}
              </p>
            </div>
            <button
              onClick={handleUnlink}
              disabled={saving}
              className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-medium disabled:opacity-50"
            >
              Unlink
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={selectedCardId}
              onChange={(e) => setSelectedCardId(e.target.value)}
              className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Select a virtual card...</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  **** {card.last4}
                  {card.cardLabel ? ` — ${card.cardLabel}` : ""}
                  {card.spendingCap ? ` ($${card.spendingCap} cap)` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={handleCardLink}
              disabled={saving || !selectedCardId}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "..." : "Link"}
            </button>
          </div>
        )}
        {!currentCard && cards.length === 0 && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            No active virtual cards for this grant. Issue a card first.
          </p>
        )}
      </div>

      {/* Billing Update Status Stepper */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Billing Update Progress</h3>
        <div className="flex items-center gap-1">
          {BILLING_STEPS.map((step, i) => {
            const isCompleted = i < currentStepIndex;
            const isCurrent = i === currentStepIndex;
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                      isCompleted
                        ? "bg-green-500 border-green-500 text-white"
                        : isCurrent
                          ? "bg-primary border-primary text-white"
                          : "bg-neutral-100 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 text-neutral-400"
                    }`}
                  >
                    {isCompleted ? "\u2713" : i + 1}
                  </div>
                  <span
                    className={`text-[10px] mt-1 text-center leading-tight ${
                      isCurrent ? "font-semibold text-primary" : "text-neutral-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < BILLING_STEPS.length - 1 && (
                  <div
                    className={`h-0.5 w-full mx-1 ${
                      isCompleted ? "bg-green-500" : "bg-neutral-200 dark:bg-neutral-700"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Advance button */}
        {nextStep && currentStepIndex >= 0 && (
          <button
            onClick={() => advanceStatus(nextStep.key)}
            disabled={saving}
            className="mt-3 px-4 py-1.5 rounded-lg border border-primary text-primary text-xs font-medium hover:bg-primary hover:text-white disabled:opacity-50 transition-colors"
          >
            {saving ? "Updating..." : `Mark as ${nextStep.label}`}
          </button>
        )}
      </div>
    </div>
  );
}

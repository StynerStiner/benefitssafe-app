"use client";

import { useState, useEffect } from "react";

export default function DisbursementPolicyTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveMaxAmount, setAutoApproveMaxAmount] = useState("100");
  const [requireReviewAbove, setRequireReviewAbove] = useState("500");

  useEffect(() => {
    fetch("/api/org/disbursement-policy")
      .then((r) => r.json())
      .then((data) => {
        if (data.policy) {
          setAutoApproveEnabled(data.policy.autoApproveEnabled ?? false);
          setAutoApproveMaxAmount(
            data.policy.autoApproveMaxAmount != null
              ? String(data.policy.autoApproveMaxAmount)
              : "100"
          );
          setRequireReviewAbove(
            data.policy.requireReviewAbove != null
              ? String(data.policy.requireReviewAbove)
              : "500"
          );
        }
      })
      .catch(() => setError("Failed to load policy"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/org/disbursement-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoApproveEnabled,
          autoApproveMaxAmount: autoApproveMaxAmount ? parseFloat(autoApproveMaxAmount) : null,
          requireReviewAbove: requireReviewAbove ? parseFloat(requireReviewAbove) : null,
          autoApproveRiskLevels: ["LIKELY_SAFE"],
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Failed to save policy");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-500">Loading policy settings...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-1">Auto-Approval Policy</h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
        Configure when card charges are automatically approved without manual review.
        Only expenses classified as LIKELY_SAFE by the compliance engine are eligible.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-400">
          Policy saved successfully.
        </div>
      )}

      <div className="space-y-6">
        {/* Auto-approve toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Enable auto-approval</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Automatically approve LIKELY_SAFE card charges below the threshold
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoApproveEnabled}
              onChange={(e) => setAutoApproveEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-primary" />
          </label>
        </div>

        {autoApproveEnabled && (
          <>
            {/* Max auto-approve amount */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Maximum auto-approve amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={autoApproveMaxAmount}
                  onChange={(e) => setAutoApproveMaxAmount(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 pl-7 pr-4 py-2 text-sm outline-none focus:border-primary"
                  placeholder="100.00"
                />
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Charges above this amount will always require manual review.
              </p>
            </div>

            {/* Require review above */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Require manual review above
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={requireReviewAbove}
                  onChange={(e) => setRequireReviewAbove(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 pl-7 pr-4 py-2 text-sm outline-none focus:border-primary"
                  placeholder="500.00"
                />
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                A secondary threshold -- charges above this always go to the approval queue.
              </p>
            </div>

            {/* Info box */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-1">
                How auto-approval works
              </p>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-disc pl-4">
                <li>A card charge arrives via Stripe Issuing webhook</li>
                <li>BenefitsSafe creates an ExpenseRequest and runs compliance classification</li>
                <li>If classified LIKELY_SAFE and below your thresholds, it auto-approves</li>
                <li>Grant balance is updated and a LedgerEntry is created automatically</li>
                <li>You receive an informational notification (no action needed)</li>
                <li>NEEDS_REVIEW, LIKELY_RISKY, or BLOCKED expenses always require manual review</li>
              </ul>
            </div>
          </>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Policy"}
        </button>
      </div>
    </div>
  );
}

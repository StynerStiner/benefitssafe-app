"use client";

import { Fragment, useState } from "react";
import toast from "react-hot-toast";

export interface StuckGrant {
  id: string;
  organizationId: string;
  organization: { name: string };
  remainingAmount: number;
  updatedAt: string;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function truncateId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export default function StuckGrantsTable({
  grants,
  loading,
  onResetSuccess,
}: {
  grants: StuckGrant[];
  loading: boolean;
  onResetSuccess: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="text-center text-neutral-500 py-12">
        Loading stuck grants…
      </div>
    );
  }

  if (grants.length === 0) {
    return (
      <div className="text-center text-neutral-500 py-12">
        No stuck overspend grants. Everything healthy.
      </div>
    );
  }

  function startReset(id: string) {
    setExpandedId(id);
  }

  function cancel(id: string) {
    setExpandedId((curr) => (curr === id ? null : curr));
    setReasonById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function submit(id: string) {
    const reason = (reasonById[id] || "").trim();
    if (reason.length < 10) return;

    setSubmittingId(id);
    try {
      const res = await fetch(
        `/api/platform/grants/${id}/reset-negative-balance-flag`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || "Failed to reset flag");
        return;
      }
      toast.success("Grant flag reset");
      cancel(id);
      onResetSuccess(id);
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-slate-700">
            <th className="text-left py-3 px-3">Organization</th>
            <th className="text-left py-3 px-3">Grant ID</th>
            <th className="text-left py-3 px-3">Remaining</th>
            <th className="text-left py-3 px-3">Updated</th>
            <th className="text-left py-3 px-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {grants.map((grant) => {
            const expanded = expandedId === grant.id;
            const reason = reasonById[grant.id] || "";
            const reasonLen = reason.trim().length;
            const isSubmitting = submittingId === grant.id;
            const canSubmit = reasonLen >= 10 && !isSubmitting;
            return (
              <Fragment key={grant.id}>
                <tr className="border-b border-neutral-100 dark:border-slate-800">
                  <td className="py-3 px-3">{grant.organization.name}</td>
                  <td
                    className="py-3 px-3 text-neutral-600 dark:text-neutral-300 font-mono"
                    title={grant.id}
                  >
                    {truncateId(grant.id)}
                  </td>
                  <td className="py-3 px-3">
                    {formatCurrency(grant.remainingAmount)}
                  </td>
                  <td className="py-3 px-3 text-neutral-600 dark:text-neutral-300">
                    {formatDate(grant.updatedAt)}
                  </td>
                  <td className="py-3 px-3">
                    {expanded ? (
                      <span className="text-neutral-500 text-xs">Editing…</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startReset(grant.id)}
                        className="btn btn-primary btn-sm"
                      >
                        Reset
                      </button>
                    )}
                  </td>
                </tr>
                {expanded && (
                  <tr className="bg-neutral-50 dark:bg-slate-900/40">
                    <td colSpan={5} className="py-4 px-3">
                      <label
                        htmlFor={`reason-${grant.id}`}
                        className="block text-sm font-medium mb-2"
                      >
                        Reason (min 10 chars)
                      </label>
                      <textarea
                        id={`reason-${grant.id}`}
                        className="w-full rounded-md border border-neutral-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm"
                        rows={3}
                        placeholder="e.g., reconciled after dispute closed 2026-04-15, Stripe D_1234 refunded"
                        value={reason}
                        onChange={(e) =>
                          setReasonById((prev) => ({
                            ...prev,
                            [grant.id]: e.target.value,
                          }))
                        }
                        disabled={isSubmitting}
                      />
                      <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                        <span
                          className={`text-xs ${
                            reasonLen >= 10
                              ? "text-green-600 dark:text-green-400"
                              : "text-neutral-500"
                          }`}
                        >
                          {reasonLen} / 10 chars minimum
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => cancel(grant.id)}
                            disabled={isSubmitting}
                            className="btn btn-secondary btn-sm"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => submit(grant.id)}
                            disabled={!canSubmit}
                            className="btn btn-primary btn-sm"
                          >
                            {isSubmitting ? "Resetting…" : "Confirm Reset"}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

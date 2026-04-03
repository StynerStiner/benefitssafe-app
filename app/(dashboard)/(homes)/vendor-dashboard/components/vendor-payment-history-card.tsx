"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Payment {
  id: string;
  amount: string;
  merchantName: string;
  status: string;
  grantName: string | null;
  beneficiaryFirstName: string | null;
  cardLabel: string | null;
  createdAt: string;
}

interface PaymentSummary {
  totalReceived: number;
  paymentCount: number;
  lastPaymentDate: string | null;
}

const VendorPaymentHistoryCard = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);

  const fetchPayments = useCallback(() => {
    // First get vendor profile to get vendorId
    fetch("/api/vendor/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((profile) => {
        if (!profile?.id) { setLoading(false); return; }
        setVendorId(profile.id);
        return fetch(`/api/vendors/${profile.id}/payments?limit=20`);
      })
      .then((r) => r?.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setPayments(data.payments || []);
          setSummary(data.summary || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const formatAmount = (a: string) =>
    `$${parseFloat(a || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Card className="card h-full border-0">
      <CardContent className="card-body">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-primary" />
          <h6 className="mb-0 font-bold text-lg">Payment History</h6>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
          </div>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-lg font-bold text-green-600">${summary.totalReceived.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-neutral-500">Total Received</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-lg font-bold text-blue-600">{summary.paymentCount}</p>
                  <p className="text-xs text-neutral-500">Payments</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <p className="text-sm font-semibold text-purple-600">
                    {summary.lastPaymentDate ? formatDate(summary.lastPaymentDate) : "--"}
                  </p>
                  <p className="text-xs text-neutral-500">Last Payment</p>
                </div>
              </div>
            )}

            {payments.length === 0 ? (
              <div className="text-center py-6">
                <DollarSign className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">No payments yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.grantName || p.merchantName}</p>
                      <p className="text-xs text-neutral-500">
                        {p.beneficiaryFirstName ? `For ${p.beneficiaryFirstName}` : ""} {p.cardLabel ? `- ${p.cardLabel}` : ""} - {formatDate(p.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-sm font-semibold">{formatAmount(p.amount)}</span>
                      <Badge variant="success" className="text-xs">Paid</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default VendorPaymentHistoryCard;

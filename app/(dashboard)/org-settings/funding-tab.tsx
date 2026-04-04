"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BanknoteIcon,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Landmark,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  Unlink,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface StripeAccountStatus {
  connected: boolean;
  bankName: string | null;
  last4: string | null;
  connectedAt: string | null;
  onboardingComplete: boolean;
  hasFinancialAccount: boolean;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  error?: string;
}

const FundingTab = () => {
  const [account, setAccount] = useState<StripeAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [fundingMethod, setFundingMethod] = useState<"direct" | "treasury">("direct");

  const fetchAccountStatus = useCallback(() => {
    setLoading(true);
    fetch("/api/org/stripe-account")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAccount(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAccountStatus();

    // Check for OAuth redirect success
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe_connect_success") === "true") {
      toast.success("Bank account connected successfully");
      window.history.replaceState({}, "", "/org-settings");
    }
  }, [fetchAccountStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/org/stripe-onboarding", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch {
      toast.error("Failed to start bank connection");
    } finally {
      setConnecting(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "--";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
      {/* ── Section 1: Connected Bank Account ── */}
      <div className="col-span-12 2xl:col-span-6">
        <Card className="card rounded-lg border-0">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Landmark className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Connected Bank Account</CardTitle>
                <CardDescription>
                  Your nonprofit's bank account funds the virtual cards. Stripe verifies and secures this connection.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {account?.connected && account.onboardingComplete ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">Bank Account Connected</p>
                    <p className="text-xs text-green-600 dark:text-green-500">
                      {account.bankName ? `${account.bankName} ` : ""}
                      {account.last4 ? `ending in ${account.last4}` : "Verified"}
                      {account.connectedAt ? ` -- Connected ${formatDate(account.connectedAt)}` : ""}
                    </p>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-center">
                    <p className="text-xs text-neutral-500 mb-1">Payouts</p>
                    <Badge variant={account.payoutsEnabled ? "success" : "warning"}>
                      {account.payoutsEnabled ? "Enabled" : "Pending"}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-center">
                    <p className="text-xs text-neutral-500 mb-1">Charges</p>
                    <Badge variant={account.chargesEnabled ? "success" : "warning"}>
                      {account.chargesEnabled ? "Enabled" : "Pending"}
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={fetchAccountStatus} className="cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh Status
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleConnect} className="cursor-pointer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Update Details
                  </Button>
                </div>
              </div>
            ) : account?.connected && !account.onboardingComplete ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <Loader2 className="w-5 h-5 text-yellow-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Onboarding Incomplete</p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-500">
                      Your Stripe account was created but onboarding is not complete. Click below to finish.
                    </p>
                  </div>
                </div>
                <Button onClick={handleConnect} disabled={connecting} className="cursor-pointer">
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Complete Onboarding
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <Unlink className="w-5 h-5 text-neutral-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Not Connected</p>
                    <p className="text-xs text-neutral-500">
                      Connect your bank account to start issuing virtual cards and disbursing grant funds.
                    </p>
                  </div>
                </div>
                <Button onClick={handleConnect} disabled={connecting} className="cursor-pointer">
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />}
                  Connect Bank Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Section 2: Funding Method ── */}
      <div className="col-span-12 2xl:col-span-6">
        <Card className="card rounded-lg border-0">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Funding Method</CardTitle>
                <CardDescription>
                  Choose how virtual cards are funded when beneficiaries make purchases.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Option A: Direct Bank Funding */}
              <label
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  fundingMethod === "direct"
                    ? "border-primary bg-primary/5"
                    : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300"
                }`}
                onClick={() => setFundingMethod("direct")}
              >
                <input
                  type="radio"
                  name="fundingMethod"
                  value="direct"
                  checked={fundingMethod === "direct"}
                  onChange={() => setFundingMethod("direct")}
                  className="mt-1 accent-primary"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <BanknoteIcon className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Direct Bank Funding</span>
                    {account?.connected && account.onboardingComplete ? (
                      <Badge variant="success" className="text-xs">Ready</Badge>
                    ) : (
                      <Badge variant="warning" className="text-xs">Pending: Connect Bank</Badge>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    Cards draw money directly from your connected bank account when beneficiaries make purchases. Simple, real-time, no pre-loading required.
                  </p>
                </div>
              </label>

              {/* Option B: Treasury Account (coming soon) */}
              <div className="flex items-start gap-3 p-4 rounded-lg border-2 border-neutral-200 dark:border-neutral-700 opacity-60">
                <input
                  type="radio"
                  name="fundingMethod"
                  value="treasury"
                  disabled
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm font-semibold text-neutral-500">Treasury Account</span>
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Pre-load funds into a Stripe Treasury account. Cards draw from that balance. Better for budget planning and fund segregation.
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    <Lock className="w-3 h-3 inline" /> Treasury Account support coming in Q2 2026
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 3: How It Works ── */}
      <div className="col-span-12">
        <Card className="card rounded-lg border-0">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              How Card Funding Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold mx-auto mb-2">1</div>
                <p className="text-sm font-medium mb-1">Admin Approves Expense</p>
                <p className="text-xs text-neutral-500">Compliance engine verifies the expense is SSI/Medi-Cal safe</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold mx-auto mb-2">2</div>
                <p className="text-sm font-medium mb-1">Virtual Card Issues</p>
                <p className="text-xs text-neutral-500">Stripe Issuing creates a card locked to approved merchant categories</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold mx-auto mb-2">3</div>
                <p className="text-sm font-medium mb-1">Beneficiary Pays</p>
                <p className="text-xs text-neutral-500">Card can only be used at approved merchants within the spending cap</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold mx-auto mb-2">4</div>
                <p className="text-sm font-medium mb-1">Bank Account Debited</p>
                <p className="text-xs text-neutral-500">Funds are drawn from your connected bank account automatically</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FundingTab;

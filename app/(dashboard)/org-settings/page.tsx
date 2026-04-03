"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    ArrowDownToLine,
    Building2,
    Calendar,
    CheckCircle,
    CheckSquare,
    CreditCard,
    DollarSign,
    ExternalLink,
    Landmark,
    Loader2,
    Mail,
    MessageSquare,
    RefreshCw,
    Settings2,
    Sheet,
    Shield,
    Trello,
    XCircle,
    Zap,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface OrgData {
    id: string;
    name: string;
    ein: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    addressStreet: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZip: string | null;
    stripeAccountId: string | null;
}

interface StripeStatus {
    accountId?: string;
    status?: string;
    error?: string;
}

interface FundBalance {
    cash: number | { usd?: number };
    inbound_pending: number | { usd?: number };
    outbound_pending: number | { usd?: number };
}

interface FundTransfer {
    id: string;
    amount: number;
    currency: string;
    status: string;
    created: number;
    description: string;
}

interface FundData {
    balance: FundBalance;
    financialAccountId: string | null;
    transfers: FundTransfer[];
    dev?: boolean;
}

interface IntegrationItem {
    provider: string;
    name: string;
    icon: string;
    status: string;
    connectedBy: string | null;
    connectedAt: string | null;
}

interface WorkflowItem {
    id: string;
    name: string;
    description: string;
    eventType: string;
    provider: string;
    actionSlug: string;
    actionConfig: Record<string, unknown>;
    category: string;
    triggerId: string | null;
    enabled: boolean;
    providerConnected: boolean;
}

interface WorkflowLogItem {
    id: string;
    eventType: string;
    provider: string;
    actionSlug: string;
    status: string;
    errorMessage: string | null;
    executionTimeMs: number | null;
    createdAt: string;
}

const PROVIDER_IMAGE_MAP: Record<string, string> = {
    gmail: "/assets/images/Connected-Services-icons/gmail.webp",
    slack: "/assets/images/Connected-Services-icons/slack.png",
    google_calendar: "/assets/images/Connected-Services-icons/google-calender.png",
    google_sheets: "/assets/images/Connected-Services-icons/google-sheets.png",
    asana: "/assets/images/Connected-Services-icons/asana.png",
    trello: "/assets/images/Connected-Services-icons/trello.png",
};

const ICON_MAP: Record<string, React.ElementType> = {
    Mail,
    MessageSquare,
    Calendar,
    Sheet,
    CheckSquare,
    Trello,
};

const inputClassName =
    "border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-12 rounded-lg !shadow-none !ring-0";

const labelClassName = "text-sm font-semibold mb-2 block text-neutral-900 dark:text-white";

const OrgSettingsPage = () => {
    const [org, setOrg] = useState<OrgData | null>(null);
    const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [connectingStripe, setConnectingStripe] = useState(false);
    const [fundData, setFundData] = useState<FundData | null>(null);
    const [fundLoading, setFundLoading] = useState(false);
    const [addFundsOpen, setAddFundsOpen] = useState(false);
    const [fundAmount, setFundAmount] = useState("");
    const [fundSubmitting, setFundSubmitting] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [website, setWebsite] = useState("");
    const [addressStreet, setAddressStreet] = useState("");
    const [addressCity, setAddressCity] = useState("");
    const [addressState, setAddressState] = useState("");
    const [addressZip, setAddressZip] = useState("");

    // Integrations & Workflows state
    const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
    const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
    const [workflowLogs, setWorkflowLogs] = useState<WorkflowLogItem[]>([]);
    const [integrationsLoading, setIntegrationsLoading] = useState(false);
    const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

    const fetchIntegrations = useCallback(() => {
        setIntegrationsLoading(true);
        Promise.all([
            fetch("/api/org/integrations").then((r) => r.ok ? r.json() : []),
            fetch("/api/org/workflows").then((r) => r.ok ? r.json() : []),
            fetch("/api/org/workflows/logs?limit=10").then((r) => r.ok ? r.json() : { data: [] }),
        ])
            .then(([intData, wfData, logData]) => {
                setIntegrations(intData);
                setWorkflows(wfData);
                setWorkflowLogs(logData.data || []);
            })
            .catch(() => {})
            .finally(() => setIntegrationsLoading(false));
    }, []);

    const handleConnectProvider = async (provider: string) => {
        setConnectingProvider(provider);
        try {
            const res = await fetch("/api/org/integrations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data?.error || "Failed to connect");
                return;
            }
            if (data.url) {
                window.open(data.url, "_blank");
                toast.success("Connection window opened");
            }
        } catch {
            toast.error("Something went wrong");
        } finally {
            setConnectingProvider(null);
        }
    };

    const handleDisconnectProvider = async (provider: string) => {
        try {
            const res = await fetch(`/api/org/integrations/${provider}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || "Failed to disconnect");
                return;
            }
            toast.success("Disconnected");
            fetchIntegrations();
        } catch {
            toast.error("Something went wrong");
        }
    };

    const handleToggleWorkflow = async (workflow: WorkflowItem) => {
        if (workflow.triggerId) {
            // Toggle existing trigger
            try {
                const res = await fetch(`/api/org/workflows/${workflow.triggerId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enabled: !workflow.enabled }),
                });
                if (!res.ok) {
                    toast.error("Failed to update workflow");
                    return;
                }
                fetchIntegrations();
            } catch {
                toast.error("Something went wrong");
            }
        } else {
            // Create new trigger from template
            try {
                const res = await fetch("/api/org/workflows", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ templateId: workflow.id }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    toast.error(data?.error || "Failed to enable workflow");
                    return;
                }
                toast.success("Workflow enabled");
                fetchIntegrations();
            } catch {
                toast.error("Something went wrong");
            }
        }
    };

    const fetchFundBalance = useCallback(() => {
        setFundLoading(true);
        fetch("/api/org/fund")
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
                if (data) setFundData(data);
            })
            .catch(() => {})
            .finally(() => setFundLoading(false));
    }, []);

    const fetchData = useCallback(() => {
        Promise.all([
            fetch("/api/org").then((r) => r.ok ? r.json() : null),
            fetch("/api/org/stripe-onboarding").then((r) => r.ok ? r.json() : null),
        ])
            .then(([orgData, stripe]) => {
                if (orgData) {
                    setOrg(orgData);
                    setName(orgData.name || "");
                    setEmail(orgData.email || "");
                    setPhone(orgData.phone || "");
                    setWebsite(orgData.website || "");
                    setAddressStreet(orgData.addressStreet || "");
                    setAddressCity(orgData.addressCity || "");
                    setAddressState(orgData.addressState || "");
                    setAddressZip(orgData.addressZip || "");
                }
                if (stripe) {
                    setStripeStatus(stripe);
                    // Fetch fund balance if Stripe is connected
                    if (stripe.status === "completed" || stripe.status === "pending") {
                        fetchFundBalance();
                    }
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [fetchFundBalance]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Organization name is required");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/org", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim() || null,
                    phone: phone.trim() || null,
                    website: website.trim() || null,
                    addressStreet: addressStreet.trim() || null,
                    addressCity: addressCity.trim() || null,
                    addressState: addressState.trim() || null,
                    addressZip: addressZip.trim() || null,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || "Failed to save");
                return;
            }
            toast.success("Organization updated");
            fetchData();
        } catch {
            toast.error("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    const handleConnectStripe = async () => {
        setConnectingStripe(true);
        try {
            const res = await fetch("/api/org/stripe-onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data?.error || "Failed to start Stripe onboarding");
                return;
            }
            if (data.url) {
                window.open(data.url, "_blank");
                toast.success("Stripe onboarding opened in a new tab");
            }
        } catch {
            toast.error("Something went wrong");
        } finally {
            setConnectingStripe(false);
        }
    };

    const handleAddFunds = async () => {
        const amount = parseFloat(fundAmount);
        if (!amount || amount <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }
        setFundSubmitting(true);
        try {
            const res = await fetch("/api/org/fund", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount,
                    bankPaymentMethodId: "pm_bank_placeholder",
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data?.error || "Failed to initiate transfer");
                return;
            }
            toast.success(
                data.dev
                    ? "Transfer initiated (dev mode)"
                    : "Transfer initiated successfully"
            );
            setAddFundsOpen(false);
            setFundAmount("");
            fetchFundBalance();
        } catch {
            toast.error("Something went wrong");
        } finally {
            setFundSubmitting(false);
        }
    };

    const getBalanceAmount = (val: number | { usd?: number } | undefined): number => {
        if (val === undefined || val === null) return 0;
        if (typeof val === "number") return val;
        return val.usd || 0;
    };

    const formatCurrency = (cents: number): string => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(cents / 100);
    };

    if (loading) {
        return (
            <>
                <DashboardBreadcrumb title="Organization" text="Organization Settings" />
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                </div>
            </>
        );
    }

    const isStripeConnected = stripeStatus?.status === "completed";
    const isStripePending = stripeStatus?.status === "pending";

    return (
        <>
            <DashboardBreadcrumb title="Organization" text="Organization Settings" />

            <Tabs defaultValue="general" className="w-full" onValueChange={(v) => { if (v === "integrations") fetchIntegrations(); }}>
                <TabsList className="bg-transparent dark:bg-transparent rounded-lg h-auto mb-6 w-full justify-start gap-3 p-0">
                    <TabsTrigger value="general" className="py-3 px-6 font-semibold text-sm inline-flex items-center gap-2 rounded-lg cursor-pointer data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:border-primary bg-white dark:bg-neutral-800 text-primary border border-primary/30 hover:border-primary hover:bg-primary/5">
                        <Building2 className="w-4 h-4" />
                        General
                    </TabsTrigger>
                    <TabsTrigger value="integrations" className="py-3 px-6 font-semibold text-sm inline-flex items-center gap-2 rounded-lg cursor-pointer data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:border-primary bg-white dark:bg-neutral-800 text-primary border border-primary/30 hover:border-primary hover:bg-primary/5">
                        <Zap className="w-4 h-4" />
                        Integrations & Automations
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="general">
            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
                {/* Bank & Payment Connection */}
                <div className="col-span-12 2xl:col-span-4">
                    <div className="flex flex-col gap-6">
                        {/* Stripe Connection Card */}
                        <Card className="card rounded-lg border-0">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                        <Landmark className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Bank Connection</CardTitle>
                                        <CardDescription>
                                            Connect your bank account to fund virtual cards
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Status */}
                                <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                                    {isStripeConnected ? (
                                        <>
                                            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-green-600">Bank Connected</p>
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                                    Your bank account is verified and ready to fund virtual cards
                                                </p>
                                            </div>
                                        </>
                                    ) : isStripePending ? (
                                        <>
                                            <Loader2 className="w-5 h-5 text-yellow-500 animate-spin shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-yellow-600">Setup Incomplete</p>
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                                    Complete your bank verification to start issuing cards
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="w-5 h-5 text-neutral-400 shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">Not Connected</p>
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                                    Connect your bank to issue virtual cards for beneficiaries
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Connect / Complete Button */}
                                <Button
                                    onClick={handleConnectStripe}
                                    disabled={connectingStripe || isStripeConnected}
                                    className="w-full h-11"
                                    variant={isStripeConnected ? "outline" : "default"}
                                >
                                    {connectingStripe ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                    )}
                                    {isStripeConnected
                                        ? "Bank Account Connected"
                                        : isStripePending
                                            ? "Complete Bank Verification"
                                            : "Connect Bank Account"}
                                </Button>

                                {stripeStatus?.accountId && (
                                    <p className="text-xs text-neutral-400 text-center">
                                        Stripe Account: {stripeStatus.accountId}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Fund Balance Card */}
                        {(isStripeConnected || isStripePending) && (
                            <Card className="card rounded-lg border-0">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                                            <DollarSign className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div className="flex-1">
                                            <CardTitle className="text-lg">Fund Balance</CardTitle>
                                            <CardDescription>
                                                Treasury Financial Account balance
                                            </CardDescription>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={fetchFundBalance}
                                            disabled={fundLoading}
                                        >
                                            <RefreshCw className={`w-4 h-4 ${fundLoading ? "animate-spin" : ""}`} />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Balance Display */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                                            <div>
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400">Available Cash</p>
                                                <p className="text-2xl font-bold text-green-600">
                                                    {fundData ? formatCurrency(getBalanceAmount(fundData.balance?.cash)) : "$0.00"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400">Inbound Pending</p>
                                                <p className="text-sm font-semibold">
                                                    {fundData ? formatCurrency(getBalanceAmount(fundData.balance?.inbound_pending)) : "$0.00"}
                                                </p>
                                            </div>
                                            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400">Outbound Pending</p>
                                                <p className="text-sm font-semibold">
                                                    {fundData ? formatCurrency(getBalanceAmount(fundData.balance?.outbound_pending)) : "$0.00"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Add Funds Button */}
                                    <Button
                                        onClick={() => setAddFundsOpen(true)}
                                        className="w-full h-11"
                                        disabled={!isStripeConnected}
                                    >
                                        <ArrowDownToLine className="w-4 h-4 mr-2" />
                                        Add Funds
                                    </Button>

                                    {fundData?.dev && (
                                        <p className="text-xs text-yellow-500 text-center">
                                            Development mode - using mock financial account
                                        </p>
                                    )}

                                    {/* Transfer History */}
                                    {fundData?.transfers && fundData.transfers.length > 0 && (
                                        <div>
                                            <p className="text-sm font-semibold mb-2 text-neutral-900 dark:text-white">Recent Transfers</p>
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                                {fundData.transfers.map((t) => (
                                                    <div
                                                        key={t.id}
                                                        className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                                                    >
                                                        <div>
                                                            <p className="text-sm font-medium">{formatCurrency(t.amount)}</p>
                                                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                                                {t.description || "Fund transfer"}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                                t.status === "succeeded"
                                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                    : t.status === "failed" || t.status === "canceled"
                                                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                            }`}>
                                                                {t.status}
                                                            </span>
                                                            {t.created && (
                                                                <p className="text-xs text-neutral-400 mt-1">
                                                                    {new Date(t.created * 1000).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* How It Works Card */}
                        <Card className="card rounded-lg border-0">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                                        <Shield className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">How Funding Works</CardTitle>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex gap-3">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0 text-xs font-bold text-primary">1</div>
                                        <div>
                                            <p className="text-sm font-medium">Connect your bank</p>
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400">Securely link your organization's bank account via Stripe</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0 text-xs font-bold text-primary">2</div>
                                        <div>
                                            <p className="text-sm font-medium">Approve expenses</p>
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400">Review and approve beneficiary expense requests</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0 text-xs font-bold text-primary">3</div>
                                        <div>
                                            <p className="text-sm font-medium">Issue virtual cards</p>
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400">One-click card issuance with spending caps and vendor locks</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/10 shrink-0 text-xs font-bold text-green-600">4</div>
                                        <div>
                                            <p className="text-sm font-medium">Funds pull automatically</p>
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400">When a card is used, funds are pulled directly from your bank. BenefitsSafe never holds your money.</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Capabilities Card */}
                        <Card className="card rounded-lg border-0">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <CreditCard className="w-5 h-5" />
                                    Card Capabilities
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                        <span className="text-sm">Real Visa cards accepted everywhere online</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                        <span className="text-sm">Per-card spending limits enforced by Stripe</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                        <span className="text-sm">Vendor-locked cards for specific merchants</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                        <span className="text-sm">Monthly recurring cards for subscriptions</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                        <span className="text-sm">Real-time compliance checks on every transaction</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                        <span className="text-sm">Beneficiary name on every card</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Organization Details Form */}
                <div className="col-span-12 2xl:col-span-8">
                    <Card className="card rounded-lg border-0">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                    <Building2 className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Organization Details</CardTitle>
                                    <CardDescription>
                                        Manage your nonprofit organization information
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSave}>
                                <div className="grid md:grid-cols-2 gap-x-5">
                                    <div className="mb-5">
                                        <Label htmlFor="name" className={labelClassName}>
                                            Organization Name <span className="text-red-600">*</span>
                                        </Label>
                                        <Input type="text" className={inputClassName} id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Nonprofit Name" required />
                                    </div>
                                    <div className="mb-5">
                                        <Label htmlFor="ein" className={labelClassName}>EIN</Label>
                                        <Input type="text" className={`${inputClassName} bg-neutral-100 dark:bg-neutral-800`} id="ein" value={org?.ein || ""} readOnly disabled placeholder="XX-XXXXXXX" />
                                    </div>
                                    <div className="mb-5">
                                        <Label htmlFor="email" className={labelClassName}>Email</Label>
                                        <Input type="email" className={inputClassName} id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="org@nonprofit.org" />
                                    </div>
                                    <div className="mb-5">
                                        <Label htmlFor="phone" className={labelClassName}>Phone</Label>
                                        <Input type="tel" className={inputClassName} id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
                                    </div>
                                    <div className="mb-5">
                                        <Label htmlFor="website" className={labelClassName}>Website</Label>
                                        <Input type="url" className={inputClassName} id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yournonprofit.org" />
                                    </div>
                                    <div className="mb-5">
                                        <Label htmlFor="addressStreet" className={labelClassName}>Street Address</Label>
                                        <Input type="text" className={inputClassName} id="addressStreet" value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder="123 Main St" />
                                    </div>
                                    <div className="mb-5">
                                        <Label htmlFor="addressCity" className={labelClassName}>City</Label>
                                        <Input type="text" className={inputClassName} id="addressCity" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder="Los Angeles" />
                                    </div>
                                    <div className="mb-5">
                                        <Label htmlFor="addressState" className={labelClassName}>State</Label>
                                        <Input type="text" className={inputClassName} id="addressState" value={addressState} onChange={(e) => setAddressState(e.target.value)} placeholder="CA" maxLength={2} />
                                    </div>
                                    <div className="mb-5">
                                        <Label htmlFor="addressZip" className={labelClassName}>Zip Code</Label>
                                        <Input type="text" className={inputClassName} id="addressZip" value={addressZip} onChange={(e) => setAddressZip(e.target.value)} placeholder="90001" maxLength={10} />
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-3 mt-4">
                                    <Button type="submit" className="h-12 px-8" disabled={saving}>
                                        {saving ? "Saving..." : "Save Changes"}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>

                </TabsContent>

                {/* Integrations & Automations Tab */}
                <TabsContent value="integrations">
                    <div className="space-y-6">
                        {/* Section 1: Connected Services */}
                        <Card className="card rounded-lg border-0">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                        <Settings2 className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Connected Services</CardTitle>
                                        <CardDescription>
                                            Connect your tools to enable automated workflows
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {integrationsLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {integrations.map((int) => {
                                            const providerImage = PROVIDER_IMAGE_MAP[int.provider];
                                            const isConnected = int.status === "connected";
                                            const isConnecting = connectingProvider === int.provider;
                                            return (
                                                <div
                                                    key={int.provider}
                                                    className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                                                >
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-neutral-700 border border-neutral-100 dark:border-neutral-600 overflow-hidden p-1.5">
                                                            {providerImage ? (
                                                                <img src={providerImage} alt={int.name} width={28} height={28} style={{ objectFit: "contain" }} />
                                                            ) : (
                                                                <Zap className="w-5 h-5 text-neutral-500" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-semibold">{int.name}</p>
                                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                                isConnected
                                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                    : "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400"
                                                            }`}>
                                                                {isConnected ? "Connected" : "Not Connected"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {isConnected && int.connectedAt && (
                                                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                                                            Connected {new Date(int.connectedAt).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                    <Button
                                                        variant={isConnected ? "outline" : "default"}
                                                        size="sm"
                                                        className="w-full"
                                                        disabled={isConnecting}
                                                        onClick={() => isConnected ? handleDisconnectProvider(int.provider) : handleConnectProvider(int.provider)}
                                                    >
                                                        {isConnecting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                                        {isConnected ? "Disconnect" : "Connect"}
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Section 2: Workflow Automations */}
                        <Card className="card rounded-lg border-0">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                        <Zap className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Workflow Automations</CardTitle>
                                        <CardDescription>
                                            Enable one-click automations that fire when key events occur
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {(["notifications", "compliance", "reporting", "scheduling"] as const).map((category) => {
                                    const categoryWorkflows = workflows.filter((w) => w.category === category);
                                    if (categoryWorkflows.length === 0) return null;
                                    return (
                                        <div key={category} className="mb-6 last:mb-0">
                                            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3 capitalize">{category}</h3>
                                            <div className="space-y-3">
                                                {categoryWorkflows.map((wf) => {
                                                    const wfImage = PROVIDER_IMAGE_MAP[wf.provider];
                                                    return (
                                                        <div
                                                            key={wf.id}
                                                            className="flex items-center gap-4 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                                                        >
                                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-neutral-700 border border-neutral-100 dark:border-neutral-600 shrink-0 overflow-hidden p-1.5">
                                                                {wfImage ? (
                                                                    <img src={wfImage} alt={wf.provider} width={22} height={22} style={{ objectFit: "contain" }} />
                                                                ) : (
                                                                    <Zap className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium truncate">{wf.name}</p>
                                                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{wf.description}</p>
                                                            </div>
                                                            {!wf.providerConnected && (
                                                                <span className="text-xs text-yellow-600 dark:text-yellow-400 whitespace-nowrap">
                                                                    Connect {wf.provider.replace(/_/g, " ")} first
                                                                </span>
                                                            )}
                                                            <Switch
                                                                checked={wf.enabled}
                                                                disabled={!wf.providerConnected}
                                                                onCheckedChange={() => handleToggleWorkflow(wf)}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                                {workflows.length === 0 && !integrationsLoading && (
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8">
                                        Connect a service above to see available automations
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Section 3: Workflow History */}
                        <Card className="card rounded-lg border-0">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                            <RefreshCw className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">Workflow History</CardTitle>
                                            <CardDescription>
                                                Recent automation executions
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={fetchIntegrations}>
                                        <RefreshCw className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {workflowLogs.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                                                    <th className="text-left py-2 pr-4 font-semibold text-neutral-600 dark:text-neutral-300">Time</th>
                                                    <th className="text-left py-2 pr-4 font-semibold text-neutral-600 dark:text-neutral-300">Event</th>
                                                    <th className="text-left py-2 pr-4 font-semibold text-neutral-600 dark:text-neutral-300">Provider</th>
                                                    <th className="text-left py-2 pr-4 font-semibold text-neutral-600 dark:text-neutral-300">Status</th>
                                                    <th className="text-left py-2 font-semibold text-neutral-600 dark:text-neutral-300">Details</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                                {workflowLogs.map((log) => (
                                                    <tr key={log.id}>
                                                        <td className="py-2 pr-4 text-xs text-neutral-500 whitespace-nowrap">
                                                            {new Date(log.createdAt).toLocaleString()}
                                                        </td>
                                                        <td className="py-2 pr-4 text-xs whitespace-nowrap">
                                                            {log.eventType.replace(/_/g, " ")}
                                                        </td>
                                                        <td className="py-2 pr-4 text-xs capitalize whitespace-nowrap">
                                                            {log.provider.replace(/_/g, " ")}
                                                        </td>
                                                        <td className="py-2 pr-4">
                                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                                log.status === "success"
                                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                    : log.status === "failed"
                                                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                            }`}>
                                                                {log.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 text-xs text-neutral-500 max-w-48 truncate">
                                                            {log.errorMessage || (log.executionTimeMs ? `${log.executionTimeMs}ms` : "--")}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8">
                                        No workflow executions yet
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Add Funds Dialog */}
            <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Funds to Treasury</DialogTitle>
                        <DialogDescription>
                            Transfer funds from your bank account into your Stripe Financial Account.
                            Funds will be available for card transactions once the ACH transfer completes (typically 2-3 business days).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="fundAmount" className={labelClassName}>
                                Amount (USD) <span className="text-red-600">*</span>
                            </Label>
                            <Input
                                type="number"
                                className={inputClassName}
                                id="fundAmount"
                                value={fundAmount}
                                onChange={(e) => setFundAmount(e.target.value)}
                                placeholder="1000.00"
                                min="1"
                                step="0.01"
                            />
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Funds will be pulled via ACH from your connected bank account into your Treasury Financial Account.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAddFundsOpen(false)}
                            disabled={fundSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddFunds}
                            disabled={fundSubmitting || !fundAmount}
                        >
                            {fundSubmitting ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <ArrowDownToLine className="w-4 h-4 mr-2" />
                            )}
                            {fundSubmitting ? "Processing..." : "Transfer Funds"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default OrgSettingsPage;

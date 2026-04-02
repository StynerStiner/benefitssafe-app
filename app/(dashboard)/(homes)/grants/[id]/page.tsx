"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";
import {
  ShieldCheck,
  ShieldX,
  CreditCard,
  Clock,
  FileText,
  Plus,
} from "lucide-react";

const MCC_NAMES: Record<string, string> = {
  "5921": "Liquor Stores",
  "5813": "Bars & Nightclubs",
  "7995": "Gambling",
  "5541": "Gas Stations",
  "6011": "ATM/Cash Withdrawal",
  "5812": "Restaurants",
  "5814": "Fast Food",
  "5651": "Clothing Stores",
  "7832": "Entertainment",
  "5912": "Pharmacies",
  "7011": "Hotels/Lodging",
  "4121": "Taxis/Rideshare",
  "5411": "Grocery Stores",
  "5422": "Meat Markets",
  "5441": "Candy Stores",
  "5451": "Dairy Products",
  "5462": "Bakeries",
  "5499": "Food Stores",
  "8011": "Doctors",
  "8021": "Dentists",
  "8211": "Schools",
  "8220": "Colleges/Universities",
  "4111": "Public Transit",
};

interface Grant {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalAmount: string;
  spentAmount: string;
  remainingAmount: string;
  startDate: string;
  endDate: string | null;
  grantIssuerName: string;
  grantIssuerContact: string | null;
  purpose: string | null;
  restrictions: string | null;
  funderRequirements: Record<string, unknown> | string | null;
  approvedMCCs: string[] | null;
  blockedMCCs: string[] | null;
  beneficiaryId: string | null;
  beneficiary: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  categories: {
    id: string;
    name: string;
    allocatedAmount: string;
    spentAmount: string;
  }[];
  createdAt: string;
}

interface VirtualCardItem {
  id: string;
  last4: string;
  cardLabel: string | null;
  status: string;
  spendingCap: string | null;
  cardType: string;
  createdAt: string;
  beneficiaryId: string | null;
  expense?: {
    requestedBy?: {
      firstName: string;
      lastName: string;
    };
  } | null;
}

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  newValue: Record<string, unknown> | null;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
  } | null;
}

interface Beneficiary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const statusVariantMap: Record<string, "default" | "success" | "warning" | "danger" | "info" | "secondary"> = {
  DRAFT: "secondary",
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "info",
  ARCHIVED: "danger",
  SUSPENDED: "danger",
};

const GrantDetailPage = () => {
  const params = useParams();
  const { data: session } = useSession();
  const orgName = (session?.user as { organizationName?: string })?.organizationName || "this organization";
  const grantId = params.id as string;

  const [grant, setGrant] = useState<Grant | null>(null);
  const [cards, setCards] = useState<VirtualCardItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Issue card dialog state
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState("");
  const [cardLabel, setCardLabel] = useState("");
  const [issuing, setIssuing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [grantRes, cardsRes, logsRes] = await Promise.all([
        fetch(`/api/grants/${grantId}`),
        fetch(`/api/virtual-cards?limit=100`),
        fetch(`/api/audit-logs?entityType=grant&entityId=${grantId}&limit=50`),
      ]);

      if (!grantRes.ok) {
        setError("Grant not found or access denied.");
        setLoading(false);
        return;
      }

      const grantData = await grantRes.json();
      setGrant(grantData);

      if (cardsRes.ok) {
        const cardsJson = await cardsRes.json();
        const allCards = Array.isArray(cardsJson) ? cardsJson : cardsJson.data || [];
        // Filter cards that belong to this grant (via expense.grantId or metadata)
        const grantCards = allCards.filter((c: Record<string, unknown>) => {
          const expense = c.expense as Record<string, unknown> | null | undefined;
          return expense?.grantId === grantId;
        });
        setCards(grantCards);
      }

      if (logsRes.ok) {
        const logsJson = await logsRes.json();
        const allLogs = Array.isArray(logsJson) ? logsJson : logsJson.data || [];
        setAuditLogs(allLogs);
      }
    } catch {
      setError("Failed to load grant details.");
    } finally {
      setLoading(false);
    }
  }, [grantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchBeneficiaries = async () => {
    try {
      const res = await fetch("/api/users?role=beneficiary&limit=100");
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json) ? json : json.data || [];
        setBeneficiaries(items);
      }
    } catch {
      // silent
    }
  };

  const handleOpenIssueDialog = () => {
    fetchBeneficiaries();
    setSelectedBeneficiary("");
    setCardLabel("");
    setIssueDialogOpen(true);
  };

  const handleIssueCard = async () => {
    if (!selectedBeneficiary) {
      toast.error("Please select a beneficiary.");
      return;
    }

    const confirmed = window.confirm(
      `Issue virtual card under "${orgName}" for this beneficiary?`,
    );
    if (!confirmed) return;

    setIssuing(true);
    try {
      const res = await fetch(`/api/grants/${grantId}/issue-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: selectedBeneficiary,
          cardLabel: cardLabel || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        toast.error(errorData?.error || "Failed to issue card.");
        return;
      }

      toast.success("Virtual card issued successfully.");
      setIssueDialogOpen(false);
      fetchData();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIssuing(false);
    }
  };

  const formatCurrency = (val: string | number) => {
    const num = parseFloat(String(val || "0"));
    return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (val: string) => {
    return new Date(val).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getProgress = (total: string, spent: string) => {
    const t = parseFloat(total || "0");
    const s = parseFloat(spent || "0");
    if (t === 0) return 0;
    return Math.round((s / t) * 100);
  };

  const getFunderRequirementsText = (grant: Grant): string | null => {
    if (grant.funderRequirements) {
      if (typeof grant.funderRequirements === "string") return grant.funderRequirements;
      return JSON.stringify(grant.funderRequirements, null, 2);
    }
    if (grant.restrictions) return grant.restrictions;
    return null;
  };

  // Extract transactions from audit logs
  const transactionLogs = auditLogs.filter(
    (log) =>
      log.entityType === "transaction" ||
      log.action === "authorize_approved" ||
      log.action === "authorize_declined"
  );

  // Non-transaction audit logs for the audit trail section
  const grantAuditLogs = auditLogs.filter(
    (log) =>
      log.entityType !== "transaction" &&
      log.action !== "authorize_approved" &&
      log.action !== "authorize_declined"
  );

  if (loading) {
    return (
      <>
        <DashboardBreadcrumb title="Grant Details" text="Loading..." />
        <LoadingSkeleton />
      </>
    );
  }

  if (error || !grant) {
    return (
      <>
        <DashboardBreadcrumb title="Grant Details" text="Error" />
        <div className="p-6">
          <p className="text-red-600 dark:text-red-400">
            {error || "Grant not found."}
          </p>
        </div>
      </>
    );
  }

  const progress = getProgress(grant.totalAmount, grant.spentAmount);
  const requirementsText = getFunderRequirementsText(grant);

  return (
    <>
      <DashboardBreadcrumb title="Grant Details" text={grant.name} />

      <div className="grid grid-cols-1 gap-6">
        {/* GRANT OVERVIEW */}
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
          <CardContent className="p-0">
            <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
              <h6 className="font-semibold text-lg mb-0 text-foreground">
                Grant Overview
              </h6>
              <Badge variant={statusVariantMap[grant.status] || "secondary"}>
                {grant.status}
              </Badge>
            </div>
            <div className="card-body p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                    Total Amount
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(grant.totalAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                    Spent
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(grant.spentAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                    Remaining
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(grant.remainingAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                    Progress
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {progress}%
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-neutral-200 dark:bg-slate-600 rounded-full h-2 mb-6">
                <div
                  className={`h-2 rounded-full ${progress > 80 ? "bg-red-500" : progress > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                    Funder
                  </p>
                  <p className="text-base font-medium text-foreground">
                    {grant.grantIssuerName}
                  </p>
                </div>
                {grant.purpose && (
                  <div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                      Purpose
                    </p>
                    <p className="text-base text-foreground">{grant.purpose}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                    Start Date
                  </p>
                  <p className="text-base text-foreground">
                    {formatDate(grant.startDate)}
                  </p>
                </div>
                {grant.endDate && (
                  <div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                      End Date
                    </p>
                    <p className="text-base text-foreground">
                      {formatDate(grant.endDate)}
                    </p>
                  </div>
                )}
                {grant.beneficiary && (
                  <div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                      Beneficiary
                    </p>
                    <p className="text-base text-foreground">
                      {grant.beneficiary.firstName} {grant.beneficiary.lastName}
                    </p>
                  </div>
                )}
              </div>

              {requirementsText && (
                <div className="mt-4 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-1">
                    Funder Requirements
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-300 whitespace-pre-wrap">
                    {requirementsText}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* COMPLIANCE RULES */}
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
          <CardContent className="p-0">
            <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
              <h6 className="font-semibold text-lg mb-0 text-foreground">
                Compliance Rules
              </h6>
              <ShieldCheck className="w-5 h-5 text-green-500" />
            </div>
            <div className="card-body p-6">
              {/* Allowed Categories */}
              {grant.approvedMCCs && Array.isArray(grant.approvedMCCs) && grant.approvedMCCs.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-semibold text-foreground mb-3">
                    Allowed Categories
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {grant.approvedMCCs.map((mcc) => (
                      <Badge key={mcc} variant="success">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        {MCC_NAMES[mcc] || `MCC ${mcc}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Blocked Categories */}
              {grant.blockedMCCs && Array.isArray(grant.blockedMCCs) && grant.blockedMCCs.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-semibold text-foreground mb-3">
                    Blocked Categories
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {grant.blockedMCCs.map((mcc) => (
                      <Badge key={mcc} variant="danger">
                        <ShieldX className="w-3 h-3 mr-1" />
                        {MCC_NAMES[mcc] || `MCC ${mcc}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {!grant.approvedMCCs?.length && !grant.blockedMCCs?.length && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No specific MCC restrictions configured for this grant. Global compliance rules still apply.
                </p>
              )}

              {/* Why these rules exist */}
              {requirementsText && (
                <div className="mt-4 p-4 rounded-lg bg-neutral-50 dark:bg-slate-700 border border-neutral-200 dark:border-slate-600">
                  <p className="text-sm font-semibold text-foreground mb-1">
                    Why These Rules Exist
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">
                    {requirementsText}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* CARDS ISSUED */}
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
          <CardContent className="p-0">
            <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
              <h6 className="font-semibold text-lg mb-0 text-foreground">
                Cards Issued
              </h6>
              <Button
                size="sm"
                onClick={handleOpenIssueDialog}
                className="flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Issue New Card
              </Button>
            </div>
            <div className="card-body p-6">
              {cards.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    No cards have been issued for this grant yet.
                  </p>
                </div>
              ) : (
                <Table className="table-auto border-spacing-0 border-separate">
                  <TableHeader>
                    <TableRow className="border-0">
                      <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600 rounded-tl-lg">
                        Card
                      </TableHead>
                      <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                        Beneficiary
                      </TableHead>
                      <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                        Issued
                      </TableHead>
                      <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                        Status
                      </TableHead>
                      <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600 rounded-tr-lg">
                        Spending Cap
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards.map((card, index) => {
                      const isLast = index === cards.length - 1;
                      return (
                        <TableRow key={card.id}>
                          <TableCell
                            className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}
                          >
                            {card.cardLabel || `Card ****${card.last4}`}
                          </TableCell>
                          <TableCell className="py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600">
                            {card.expense?.requestedBy
                              ? `${card.expense.requestedBy.firstName} ${card.expense.requestedBy.lastName}`
                              : "N/A"}
                          </TableCell>
                          <TableCell className="py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600">
                            {formatDate(card.createdAt)}
                          </TableCell>
                          <TableCell className="py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600">
                            <Badge
                              variant={
                                card.status === "ACTIVE"
                                  ? "success"
                                  : card.status === "FROZEN"
                                    ? "warning"
                                    : "danger"
                              }
                            >
                              {card.status}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-br-lg" : ""}`}
                          >
                            {card.spendingCap
                              ? formatCurrency(card.spendingCap)
                              : "No limit"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RECENT TRANSACTIONS */}
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
          <CardContent className="p-0">
            <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
              <h6 className="font-semibold text-lg mb-0 text-foreground">
                Recent Transactions
              </h6>
              <Clock className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="card-body p-6">
              {transactionLogs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    No transactions yet.
                  </p>
                </div>
              ) : (
                <Table className="table-auto border-spacing-0 border-separate">
                  <TableHeader>
                    <TableRow className="border-0">
                      <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600 rounded-tl-lg">
                        Date
                      </TableHead>
                      <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                        Merchant
                      </TableHead>
                      <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                        Amount
                      </TableHead>
                      <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                        Decision
                      </TableHead>
                      <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600 rounded-tr-lg">
                        Reason
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionLogs.map((log, index) => {
                      const isLast = index === transactionLogs.length - 1;
                      const val = log.newValue || {};
                      const merchantName = (val.merchantName as string) || "Unknown";
                      const amount = val.amount as number | undefined;
                      const approved = val.approved as boolean | undefined;
                      const failedReasons = (val.failedReasons as string[]) || [];

                      return (
                        <TableRow key={log.id}>
                          <TableCell
                            className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""}`}
                          >
                            {formatDate(log.createdAt)}
                          </TableCell>
                          <TableCell className="py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600">
                            {merchantName}
                          </TableCell>
                          <TableCell className="py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600">
                            {amount !== undefined
                              ? formatCurrency(amount)
                              : "N/A"}
                          </TableCell>
                          <TableCell className="py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600">
                            <Badge
                              variant={approved ? "success" : "danger"}
                            >
                              {approved ? "Approved" : "Declined"}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-br-lg" : ""}`}
                          >
                            {approved
                              ? "All checks passed"
                              : failedReasons.join(", ") || "Check failed"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AUDIT TRAIL */}
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
          <CardContent className="p-0">
            <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
              <h6 className="font-semibold text-lg mb-0 text-foreground">
                Audit Trail
              </h6>
              <FileText className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="card-body p-6">
              {grantAuditLogs.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                  No audit entries for this grant yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {grantAuditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between gap-4 py-3 border-b border-neutral-100 dark:border-slate-700 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {log.action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {log.user
                            ? `${log.user.firstName} ${log.user.lastName}`
                            : log.userId || "System"}
                        </p>
                      </div>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ISSUE CARD DIALOG */}
      <Dialog
        open={issueDialogOpen}
        onOpenChange={(open) => {
          if (!open) setIssueDialogOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue New Card</DialogTitle>
            <DialogDescription>
              Issue a virtual card for this grant. The card will inherit the
              grant&apos;s compliance rules.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="beneficiary-select">Beneficiary</Label>
              <Select
                value={selectedBeneficiary}
                onValueChange={setSelectedBeneficiary}
              >
                <SelectTrigger id="beneficiary-select" className="mt-1">
                  <SelectValue placeholder="Select a beneficiary" />
                </SelectTrigger>
                <SelectContent>
                  {beneficiaries.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.firstName} {b.lastName} ({b.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="card-label-input">
                Card Label (optional)
              </Label>
              <Input
                id="card-label-input"
                value={cardLabel}
                onChange={(e) => setCardLabel(e.target.value)}
                placeholder="e.g. Writing Supplies Card"
                className="mt-1"
              />
            </div>

            {grant.blockedMCCs && Array.isArray(grant.blockedMCCs) && grant.blockedMCCs.length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">
                  Blocked Categories on This Grant
                </p>
                <div className="flex flex-wrap gap-1">
                  {grant.blockedMCCs.map((mcc) => (
                    <Badge key={mcc} variant="danger" className="text-xs">
                      {MCC_NAMES[mcc] || `MCC ${mcc}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIssueDialogOpen(false)}
              disabled={issuing}
            >
              Cancel
            </Button>
            <Button onClick={handleIssueCard} disabled={issuing}>
              {issuing ? "Issuing..." : "Issue Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GrantDetailPage;

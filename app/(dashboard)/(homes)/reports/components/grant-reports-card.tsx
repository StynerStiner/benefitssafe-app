"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BarChart3, Calendar, Download, FileText, Loader2, Shield, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface GrantReport {
  id: string;
  organizationId: string;
  grantId: string;
  reportType: string;
  reportData: ReportData;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  generatedBy: string;
  status: string;
}

interface ReportData {
  grantId: string;
  grantName: string;
  grantIssuer: string | null;
  generatedAt: string;
  disbursement: {
    totalGrantAmount: number;
    totalDisbursed: number;
    totalRemaining: number;
    percentageUtilized: number;
    uniqueBeneficiariesServed: number;
    expenseRequests: {
      total: number;
      approved: number;
      rejected: number;
      pending: number;
      paid: number;
    };
    averageExpenseAmount: number;
    periodStart: string;
    periodEnd: string;
  };
  categories: {
    categoryName: string;
    budgetedAmount: number;
    spentAmount: number;
    remainingAmount: number;
    percentageUsed: number;
    status: string;
  }[];
  beneficiaries: {
    name: string;
    expenseCount: number;
    totalDisbursed: number;
    cardStatus: string;
  }[];
  compliance: {
    riskBreakdown: {
      likelySafe: number;
      needsReview: number;
      likelyRisky: number;
      blocked: number;
      pending: number;
    };
    mccViolations: number;
    thresholdWarnings: number;
  };
  timeline: {
    startDate: string;
    endDate: string | null;
    daysElapsed: number;
    daysRemaining: number | null;
    totalDurationDays: number | null;
    burnRateWeekly: number;
    projectedExhaustionDate: string | null;
    healthStatus: string;
    healthReason: string;
  };
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function healthBadgeVariant(status: string): "success" | "info" | "danger" | "warning" {
  switch (status) {
    case "on_track": return "success";
    case "ahead_of_schedule": return "info";
    case "at_risk": return "danger";
    default: return "warning";
  }
}

function healthLabel(status: string): string {
  switch (status) {
    case "on_track": return "On Track";
    case "ahead_of_schedule": return "Ahead of Schedule";
    case "at_risk": return "At Risk";
    default: return status;
  }
}

const GrantReportsCard = () => {
  const [reports, setReports] = useState<GrantReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<GrantReport | null>(null);

  const fetchReports = useCallback(() => {
    setLoading(true);
    fetch("/api/reports/grants?limit=20")
      .then((r) => (r.ok ? r.json() : { reports: [] }))
      .then((data) => setReports(data.reports || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const d = selectedReport?.reportData;

  return (
    <>
      <Card className="card border-0">
        <CardContent className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="mb-0 font-bold text-lg">Grant Reports</h3>
            </div>
            <span className="text-sm text-neutral-500">{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No grant reports yet. Reports are auto-generated weekly by SentinelLayer.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const rd = report.reportData;
                return (
                  <div
                    key={report.id}
                    className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h6 className="text-sm font-semibold mb-0.5">{rd.grantName}</h6>
                        <span className="text-xs text-neutral-500">{formatDate(report.generatedAt)}</span>
                        {rd.grantIssuer && (
                          <span className="text-xs text-neutral-400 ml-2">by {rd.grantIssuer}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={healthBadgeVariant(rd.timeline.healthStatus)}>
                          {healthLabel(rd.timeline.healthStatus)}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs cursor-pointer"
                          onClick={() => setSelectedReport(report)}
                        >
                          View Report
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-neutral-500">{rd.disbursement.percentageUtilized}% utilized</span>
                          <span className="text-neutral-500">{formatMoney(rd.disbursement.totalDisbursed)} / {formatMoney(rd.disbursement.totalGrantAmount)}</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              rd.timeline.healthStatus === "at_risk" ? "bg-red-500" :
                              rd.timeline.healthStatus === "ahead_of_schedule" ? "bg-blue-500" : "bg-green-500"
                            )}
                            style={{ width: `${Math.min(100, rd.disbursement.percentageUtilized)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-neutral-500 shrink-0">
                        {rd.disbursement.uniqueBeneficiariesServed} beneficiar{rd.disbursement.uniqueBeneficiariesServed !== 1 ? "ies" : "y"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Detail Modal */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {d && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{d.grantName}</span>
                  <Badge variant={healthBadgeVariant(d.timeline.healthStatus)}>
                    {healthLabel(d.timeline.healthStatus)}
                  </Badge>
                </DialogTitle>
                <p className="text-sm text-neutral-500">
                  {d.grantIssuer ? `Funded by ${d.grantIssuer} | ` : ""}
                  Report generated {formatDate(d.generatedAt)}
                </p>
              </DialogHeader>

              {/* Section 1: Disbursement Summary */}
              <div className="mt-4">
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Disbursement Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatBox label="Total Budget" value={formatMoney(d.disbursement.totalGrantAmount)} />
                  <StatBox label="Disbursed" value={formatMoney(d.disbursement.totalDisbursed)} />
                  <StatBox label="Remaining" value={formatMoney(d.disbursement.totalRemaining)} />
                  <StatBox label="Utilized" value={`${d.disbursement.percentageUtilized}%`} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                  <StatBox label="Beneficiaries" value={String(d.disbursement.uniqueBeneficiariesServed)} />
                  <StatBox label="Total Expenses" value={String(d.disbursement.expenseRequests.total)} />
                  <StatBox label="Approved" value={String(d.disbursement.expenseRequests.approved)} />
                  <StatBox label="Avg Expense" value={formatMoney(d.disbursement.averageExpenseAmount)} />
                </div>
              </div>

              {/* Section 2: Spending by Category */}
              {d.categories.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Spending by Category
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="text-left pb-2 text-xs font-medium text-neutral-500">Category</th>
                          <th className="text-right pb-2 text-xs font-medium text-neutral-500">Budgeted</th>
                          <th className="text-right pb-2 text-xs font-medium text-neutral-500">Spent</th>
                          <th className="text-right pb-2 text-xs font-medium text-neutral-500">Remaining</th>
                          <th className="text-right pb-2 text-xs font-medium text-neutral-500">Used</th>
                          <th className="text-right pb-2 text-xs font-medium text-neutral-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.categories.map((cat) => (
                          <tr key={cat.categoryName} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                            <td className="py-2 font-medium">{cat.categoryName}</td>
                            <td className="py-2 text-right text-neutral-600 dark:text-neutral-400">{formatMoney(cat.budgetedAmount)}</td>
                            <td className="py-2 text-right">{formatMoney(cat.spentAmount)}</td>
                            <td className="py-2 text-right text-neutral-600 dark:text-neutral-400">{formatMoney(cat.remainingAmount)}</td>
                            <td className="py-2 text-right">{cat.percentageUsed}%</td>
                            <td className="py-2 text-right">
                              <Badge variant={cat.status === "overspent" ? "danger" : cat.status === "warning" ? "warning" : "success"} className="text-xs">
                                {cat.status === "on_track" ? "OK" : cat.status === "warning" ? "90%+" : "Over"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section 3: Beneficiary Impact */}
              {d.beneficiaries.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                    <Users className="w-4 h-4 text-primary" />
                    Beneficiary Impact
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="text-left pb-2 text-xs font-medium text-neutral-500">Name</th>
                          <th className="text-right pb-2 text-xs font-medium text-neutral-500">Expenses</th>
                          <th className="text-right pb-2 text-xs font-medium text-neutral-500">Disbursed</th>
                          <th className="text-right pb-2 text-xs font-medium text-neutral-500">Card</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.beneficiaries.map((ben) => (
                          <tr key={ben.name} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                            <td className="py-2 font-medium">{ben.name}</td>
                            <td className="py-2 text-right">{ben.expenseCount}</td>
                            <td className="py-2 text-right">{formatMoney(ben.totalDisbursed)}</td>
                            <td className="py-2 text-right">
                              <Badge variant={ben.cardStatus === "active" ? "success" : ben.cardStatus === "frozen" ? "warning" : "secondary"} className="text-xs">
                                {ben.cardStatus}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section 4: Compliance Summary */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                  <Shield className="w-4 h-4 text-primary" />
                  Compliance Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <StatBox label="Likely Safe" value={String(d.compliance.riskBreakdown.likelySafe)} color="text-green-600" />
                  <StatBox label="Needs Review" value={String(d.compliance.riskBreakdown.needsReview)} color="text-yellow-600" />
                  <StatBox label="Likely Risky" value={String(d.compliance.riskBreakdown.likelyRisky)} color="text-orange-600" />
                  <StatBox label="Blocked" value={String(d.compliance.riskBreakdown.blocked)} color="text-red-600" />
                  <StatBox label="Pending" value={String(d.compliance.riskBreakdown.pending)} />
                </div>
                {(d.compliance.mccViolations > 0 || d.compliance.thresholdWarnings > 0) && (
                  <div className="flex gap-4 mt-2 text-xs">
                    {d.compliance.mccViolations > 0 && (
                      <span className="text-red-600">{d.compliance.mccViolations} MCC violation{d.compliance.mccViolations !== 1 ? "s" : ""}</span>
                    )}
                    {d.compliance.thresholdWarnings > 0 && (
                      <span className="text-amber-600">{d.compliance.thresholdWarnings} threshold warning{d.compliance.thresholdWarnings !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Section 5: Timeline */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                  <Calendar className="w-4 h-4 text-primary" />
                  Timeline & Projections
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatBox label="Start Date" value={d.timeline.startDate} />
                  <StatBox label="End Date" value={d.timeline.endDate || "Open-ended"} />
                  <StatBox label="Days Elapsed" value={String(d.timeline.daysElapsed)} />
                  <StatBox label="Days Remaining" value={d.timeline.daysRemaining !== null ? String(d.timeline.daysRemaining) : "N/A"} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                  <StatBox label="Burn Rate" value={`${formatMoney(d.timeline.burnRateWeekly)}/week`} />
                  <StatBox label="Projected Exhaustion" value={d.timeline.projectedExhaustionDate || "N/A"} />
                  <StatBox label="Status" value={healthLabel(d.timeline.healthStatus)} color={
                    d.timeline.healthStatus === "at_risk" ? "text-red-600" :
                    d.timeline.healthStatus === "ahead_of_schedule" ? "text-blue-600" : "text-green-600"
                  } />
                </div>
                <p className="text-xs text-neutral-500 mt-2">{d.timeline.healthReason}</p>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast.success("PDF export coming soon");
                  }}
                  className="cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
                <Button size="sm" onClick={() => setSelectedReport(null)} className="cursor-pointer">
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-center">
      <p className={cn("text-sm font-semibold mb-0", color || "text-neutral-900 dark:text-white")}>{value}</p>
      <p className="text-xs text-neutral-500 mb-0">{label}</p>
    </div>
  );
}

export default GrantReportsCard;

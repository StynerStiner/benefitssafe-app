"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Shield,
  AlertTriangle,
  User,
  Pencil,
  Calendar,
  DollarSign,
  FileText,
  CircleAlert,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface BenefitPrograms {
  ssi: boolean;
  ssdi: boolean;
  mediCal: boolean;
  calFresh: boolean;
  ihss: boolean;
  able: boolean;
}

interface Grant {
  id: string;
  name: string;
  grantIssuerName: string | null;
  totalAmount: number;
  spentAmount: number;
  remainingAmount: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  benefitFlags: Record<string, boolean> | null;
  categories: { id: string; name: string; allocatedAmount: number; spentAmount: number }[];
}

interface ExpenseRequest {
  id: string;
  description: string;
  amount: number;
  expenseType: string;
  status: string;
  riskClassification: string | null;
  riskNotes: string | null;
  rejectedReason: string | null;
  createdAt: string;
  grant: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}

interface Beneficiary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  dateOfBirth: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  ssnLast4: string | null;
  benefitPrograms: BenefitPrograms | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  inviteStatus: "not_invited" | "invited" | "active";
  inviteSentAt: string | null;
  inviteHistory: {
    id: string;
    sentTo: string;
    method: "email" | "link";
    sentAt: string;
    expiresAt: string;
    usedAt: string | null;
    status: "accepted" | "expired" | "pending";
  }[];
  grants: Grant[];
  expenseRequests: ExpenseRequest[];
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatMoney(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getStatusBadgeVariant(
  status: string,
): "success" | "warning" | "danger" | "info" | "secondary" {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "APPROVED":
      return "success";
    case "DRAFT":
    case "NOT_INVITED":
      return "secondary";
    case "PAUSED":
    case "PENDING":
    case "INVITED":
      return "warning";
    case "COMPLETED":
    case "PAID":
      return "info";
    case "ARCHIVED":
    case "REJECTED":
      return "danger";
    default:
      return "secondary";
  }
}

function getRiskBadgeVariant(
  risk: string | null,
): "success" | "warning" | "danger" | "info" | "secondary" {
  if (!risk) return "secondary";
  switch (risk.toUpperCase()) {
    case "LIKELY_SAFE":
      return "success";
    case "NEEDS_REVIEW":
      return "warning";
    case "LIKELY_RISKY":
      return "warning";
    case "BLOCKED":
      return "danger";
    default:
      return "secondary";
  }
}

function formatRiskLabel(risk: string | null): string {
  if (!risk) return "N/A";
  return risk.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/* Page Component                                                      */
/* ------------------------------------------------------------------ */

const BeneficiaryProfilePage = () => {
  const params = useParams();
  const id = params.id as string;

  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/beneficiaries/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load beneficiary");
        return r.json();
      })
      .then((data: Beneficiary) => setBeneficiary(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <>
        <DashboardBreadcrumb title="Beneficiary Profile" text="Loading..." />
        <LoadingSkeleton />
      </>
    );
  }

  if (error || !beneficiary) {
    return (
      <>
        <DashboardBreadcrumb title="Beneficiary Profile" text="Error" />
        <div className="mb-4">
          <Link href="/beneficiaries">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4" />
              Back to Beneficiaries
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <CircleAlert className="mx-auto mb-3 size-10 text-neutral-400 dark:text-neutral-500" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {error || "Beneficiary not found."}
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  const fullName = `${beneficiary.firstName} ${beneficiary.lastName}`;
  const initials = `${beneficiary.firstName.charAt(0)}${beneficiary.lastName.charAt(0)}`.toUpperCase();
  const programs = beneficiary.benefitPrograms;

  const programList: { key: keyof BenefitPrograms; label: string }[] = [
    { key: "ssi", label: "SSI" },
    { key: "ssdi", label: "SSDI" },
    { key: "mediCal", label: "Medi-Cal" },
    { key: "calFresh", label: "CalFresh" },
    { key: "ihss", label: "IHSS" },
    { key: "able", label: "ABLE" },
  ];

  const hasAddress =
    beneficiary.addressStreet ||
    beneficiary.addressCity ||
    beneficiary.addressState ||
    beneficiary.addressZip;

  return (
    <>
      {/* Breadcrumb */}
      <DashboardBreadcrumb title={fullName} text="Beneficiary Profile" />

      {/* Back link */}
      <div className="mb-6">
        <Link href="/beneficiaries">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            Back to Beneficiaries
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-6">
        {/* -------------------------------------------------------- */}
        {/* Section 1: Profile Header                                 */}
        {/* -------------------------------------------------------- */}
        <Card>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {/* Initials circle */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-white">
                  {initials}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                      {fullName}
                    </h2>
                    <Badge
                      variant={getStatusBadgeVariant(beneficiary.inviteStatus)}
                    >
                      {formatStatusLabel(beneficiary.inviteStatus)}
                    </Badge>
                    {!beneficiary.isActive && (
                      <Badge variant="danger">Inactive</Badge>
                    )}
                  </div>

                  <div className="mt-1 flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-400">
                    {beneficiary.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="size-3.5" />
                        {beneficiary.email}
                      </span>
                    )}
                    {beneficiary.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="size-3.5" />
                        {beneficiary.phone}
                      </span>
                    )}
                    {beneficiary.ssnLast4 && (
                      <span className="flex items-center gap-1.5">
                        <Shield className="size-3.5" />
                        SSN: {beneficiary.ssnLast4}
                      </span>
                    )}
                    {beneficiary.dateOfBirth && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        DOB: {formatDate(beneficiary.dateOfBirth)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Edit placeholder */}
              <div className="shrink-0">
                <Button variant="outline" size="sm" disabled>
                  <Pencil className="size-4" />
                  Edit Profile
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* -------------------------------------------------------- */}
        {/* Section 2: Benefit Programs                               */}
        {/* -------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4" />
              Benefit Programs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {programList.map((p) => {
                const enrolled = programs?.[p.key] ?? false;
                return (
                  <div
                    key={p.key}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center",
                      enrolled
                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                        : "border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50"
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium",
                        enrolled
                          ? "text-green-700 dark:text-green-400"
                          : "text-neutral-500 dark:text-neutral-400"
                      )}
                    >
                      {p.label}
                    </span>
                    <Badge variant={enrolled ? "success" : "secondary"}>
                      {enrolled ? "Enrolled" : "Not Enrolled"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* -------------------------------------------------------- */}
        {/* Section 3: Contact & Address                              */}
        {/* -------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4" />
              Contact &amp; Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Address */}
              <div>
                <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Address
                </h4>
                {hasAddress ? (
                  <div className="text-sm text-neutral-700 dark:text-neutral-300">
                    {beneficiary.addressStreet && <p>{beneficiary.addressStreet}</p>}
                    <p>
                      {[beneficiary.addressCity, beneficiary.addressState]
                        .filter(Boolean)
                        .join(", ")}
                      {beneficiary.addressZip ? ` ${beneficiary.addressZip}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500">
                    No address on file
                  </p>
                )}
              </div>

              {/* Emergency Contact */}
              <div>
                <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Emergency Contact
                </h4>
                {beneficiary.emergencyContactName ? (
                  <div className="text-sm text-neutral-700 dark:text-neutral-300">
                    <p className="flex items-center gap-1.5">
                      <User className="size-3.5" />
                      {beneficiary.emergencyContactName}
                    </p>
                    {beneficiary.emergencyContactPhone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="size-3.5" />
                        {beneficiary.emergencyContactPhone}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500">
                    No emergency contact on file
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Notes
                </h4>
                {beneficiary.notes ? (
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    {beneficiary.notes}
                  </p>
                ) : (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500">
                    No notes
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* -------------------------------------------------------- */}
        {/* Section 4: Grants                                         */}
        {/* -------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="size-4" />
              Grants
            </CardTitle>
          </CardHeader>
          <CardContent>
            {beneficiary.grants.length === 0 ? (
              <div className="py-8 text-center">
                <DollarSign className="mx-auto mb-2 size-8 text-neutral-300 dark:text-neutral-600" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No grants yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="whitespace-nowrap pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Grant Name
                      </th>
                      <th className="whitespace-nowrap pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Issuer
                      </th>
                      <th className="whitespace-nowrap pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Total
                      </th>
                      <th className="whitespace-nowrap pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Spent
                      </th>
                      <th className="whitespace-nowrap pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Remaining
                      </th>
                      <th className="whitespace-nowrap pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Status
                      </th>
                      <th className="whitespace-nowrap pb-3 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Dates
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {beneficiary.grants.map((grant) => (
                      <tr
                        key={grant.id}
                        className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                      >
                        <td className="whitespace-nowrap py-3 pr-4 font-medium text-neutral-900 dark:text-white">
                          {grant.name}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-neutral-600 dark:text-neutral-400">
                          {grant.grantIssuerName || "--"}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-neutral-700 dark:text-neutral-300">
                          {formatMoney(grant.totalAmount)}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-neutral-700 dark:text-neutral-300">
                          {formatMoney(grant.spentAmount)}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 font-medium text-neutral-900 dark:text-white">
                          {formatMoney(grant.remainingAmount)}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4">
                          <Badge variant={getStatusBadgeVariant(grant.status)}>
                            {formatStatusLabel(grant.status)}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap py-3 text-neutral-600 dark:text-neutral-400">
                          {formatDate(grant.startDate)} - {formatDate(grant.endDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* -------------------------------------------------------- */}
        {/* Section 5: Recent Expenses                                */}
        {/* -------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" />
              Recent Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {beneficiary.expenseRequests.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="mx-auto mb-2 size-8 text-neutral-300 dark:text-neutral-600" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No expenses yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="whitespace-nowrap pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Description
                      </th>
                      <th className="whitespace-nowrap pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Amount
                      </th>
                      <th className="whitespace-nowrap pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Type
                      </th>
                      <th className="whitespace-nowrap pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Status
                      </th>
                      <th className="whitespace-nowrap pb-3 pr-4 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Risk
                      </th>
                      <th className="whitespace-nowrap pb-3 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {beneficiary.expenseRequests.map((expense) => (
                      <tr
                        key={expense.id}
                        className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                      >
                        <td className="max-w-[200px] truncate py-3 pr-4 font-medium text-neutral-900 dark:text-white">
                          {expense.description}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-neutral-700 dark:text-neutral-300">
                          {formatMoney(expense.amount)}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-neutral-600 dark:text-neutral-400">
                          {formatStatusLabel(expense.expenseType)}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4">
                          <Badge variant={getStatusBadgeVariant(expense.status)}>
                            {formatStatusLabel(expense.status)}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4">
                          <Badge
                            variant={getRiskBadgeVariant(expense.riskClassification)}
                            className={cn(
                              expense.riskClassification?.toUpperCase() === "LIKELY_RISKY" &&
                                "bg-orange-100 text-orange-600 dark:bg-orange-600/25 dark:text-orange-400"
                            )}
                          >
                            {expense.riskClassification?.toUpperCase() === "LIKELY_RISKY" && (
                              <AlertTriangle className="size-3" />
                            )}
                            {expense.riskClassification?.toUpperCase() === "BLOCKED" && (
                              <CircleAlert className="size-3" />
                            )}
                            {formatRiskLabel(expense.riskClassification)}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap py-3 text-neutral-600 dark:text-neutral-400">
                          {formatDate(expense.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default BeneficiaryProfilePage;
